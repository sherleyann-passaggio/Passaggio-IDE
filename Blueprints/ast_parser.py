#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ast_parser.py
Sovereign Workstation — AST Scanner
───────────────────────────────────
Indexes Python classes, functional contracts, and import dependencies
using the native `ast` module. Emits a JSON representation suitable
for the Unified Gateway and IDE Tree Views.

Behaviour
---------
* Recursively scans `.py` files under a given root.
* Extracts class hierarchies, method signatures (type hints), docstrings,
 decorators, and body-level call graphs.
* Strips boilerplate stubs (bare `pass`, `...`, or `NotImplementedError`)
 when --strip-boilerplate is supplied (default: true).
* Prints compact JSON to stdout (or writes to --output).
"""

import argparse
import ast
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


DEFAULT_EXCLUDES = {
   "venv", ".venv", "env", ".env", "__pycache__", ".git",
   "node_modules", ".pytest_cache", ".mypy_cache", "build", "dist",
}


def _unparse(node: Optional[ast.AST]) -> Optional[str]:
   """Safely unparse an AST node back to source text (Python 3.9+)."""
   if node is None:
       return None
   if hasattr(ast, "unparse"):
       try:
           return ast.unparse(node)
       except Exception:
           return None
   return None


def _is_boilerplate(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
   """Detect trivial boilerplate stubs."""
   if len(node.body) != 1:
       return False
   single = node.body[0]
   if isinstance(single, ast.Pass):
       return True
   if isinstance(single, ast.Expr) and isinstance(single.value, ast.Constant):
       if single.value.value is ...:
           return True
   if isinstance(single, ast.Raise):
       exc = single.exc
       if isinstance(exc, ast.Call) and isinstance(exc.func, ast.Name):
           if exc.func.id == "NotImplementedError":
               return True
       if isinstance(exc, ast.Name) and exc.id == "NotImplementedError":
           return True
   return False


def _get_call_name(node: ast.expr) -> Optional[str]:
   """Reconstruct a dotted call name from an AST Call func node."""
   if isinstance(node, ast.Name):
       return node.id
   if isinstance(node, ast.Attribute):
       prefix = _get_call_name(node.value)
       return f"{prefix}.{node.attr}" if prefix else node.attr
   if isinstance(node, ast.Subscript):
       return _get_call_name(node.value)
   if isinstance(node, ast.Call):
       return _get_call_name(node.func)
   return None


def _extract_import(node: ast.Import | ast.ImportFrom) -> List[Dict[str, Any]]:
   out = []
   if isinstance(node, ast.Import):
       for alias in node.names:
           out.append({
               "module": None,
               "name": alias.name,
               "as": alias.asname,
               "line": node.lineno,
           })
   elif isinstance(node, ast.ImportFrom):
       module = node.module
       for alias in node.names:
           out.append({
               "module": module,
               "name": alias.name,
               "as": alias.asname,
               "line": node.lineno,
           })
   return out


def _extract_signature(node: ast.arguments) -> Dict[str, Any]:
   """Extract a structured, contract-oriented view of function arguments."""
   args: List[Dict[str, Any]] = []

   # Positional-only
   for arg in node.posonlyargs:
       args.append({
           "name": arg.arg,
           "type": _unparse(arg.annotation),
           "kind": "positional-only",
           "default": None,
       })

   # Regular args
   for arg in node.args:
       args.append({
           "name": arg.arg,
           "type": _unparse(arg.annotation),
           "kind": "positional",
           "default": None,
       })

   # *args
   vararg = None
   if node.vararg:
       vararg = {
           "name": node.vararg.arg,
           "type": _unparse(node.vararg.annotation),
       }

   # Keyword-only
   for arg in node.kwonlyargs:
       args.append({
           "name": arg.arg,
           "type": _unparse(arg.annotation),
           "kind": "keyword-only",
           "default": None,
       })

   # **kwargs
   kwarg = None
   if node.kwarg:
       kwarg = {
           "name": node.kwarg.arg,
           "type": _unparse(node.kwarg.annotation),
       }

   raw_sig = _unparse(node)

   return {
       "raw": raw_sig,
       "args": args,
       "vararg": vararg,
       "kwarg": kwarg,
       "kw_defaults": [_unparse(d) for d in node.kw_defaults],
       "defaults": [_unparse(d) for d in node.defaults],
   }


def _body_summary(node: ast.FunctionDef | ast.AsyncFunctionDef) -> Dict[str, Any]:
   """Summarise the function body: calls made, return/yield presence."""
   calls: List[str] = []
   has_return = False
   has_yield = False
   has_raise = False
   assignments: List[str] = []

   for child in ast.walk(node):
       if isinstance(child, ast.Call):
           name = _get_call_name(child.func)
           if name:
               calls.append(name)
       if isinstance(child, ast.Return):
           has_return = True
       if isinstance(child, (ast.Yield, ast.YieldFrom)):
           has_yield = True
       if isinstance(child, ast.Raise):
           has_raise = True
       if isinstance(child, ast.Assign):
           for tgt in child.targets:
               if isinstance(tgt, ast.Name):
                   assignments.append(tgt.id)

   return {
       "calls": sorted(set(calls)),
       "assigns": sorted(set(assignments)),
       "returns": has_return,
       "yields": has_yield,
       "raises": has_raise,
   }


def _extract_function(
   node: ast.FunctionDef | ast.AsyncFunctionDef,
   qualifier: str = "",
   strip_boilerplate: bool = True,
) -> Optional[Dict[str, Any]]:
   """Build a functional-contract record from a function or async def node."""
   if strip_boilerplate and _is_boilerplate(node):
       return None

   qname = f"{qualifier}.{node.name}" if qualifier else node.name
   decorators = [_unparse(d) for d in node.decorator_list]
   summary = _body_summary(node)

   return {
       "name": node.name,
       "qualified_name": qname,
       "line_range": [node.lineno, getattr(node, "end_lineno", node.lineno)],
       "decorators": [d for d in decorators if d is not None],
       "is_async": isinstance(node, ast.AsyncFunctionDef),
       "signature": _extract_signature(node.args),
       "returns": _unparse(node.returns),
       "docstring": ast.get_docstring(node),
       "body_summary": summary,
       "is_boilerplate": _is_boilerplate(node),
   }


def _extract_class(
   node: ast.ClassDef,
   qualifier: str = "",
   strip_boilerplate: bool = True,
) -> Dict[str, Any]:
   """Build a class record including methods and class-level attributes."""
   qname = f"{qualifier}.{node.name}" if qualifier else node.name

   methods: List[Dict[str, Any]] = []
   class_attributes: List[Dict[str, Any]] = []

   for item in node.body:
       if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
           meth = _extract_function(item, qname, strip_boilerplate)
           if meth is not None:
               methods.append(meth)
       elif isinstance(item, ast.AnnAssign):
           if isinstance(item.target, ast.Name):
               class_attributes.append({
                   "name": item.target.id,
                   "type": _unparse(item.annotation),
                   "line": item.lineno,
                   "has_default": item.value is not None,
               })
       elif isinstance(item, ast.Assign):
           for tgt in item.targets:
               if isinstance(tgt, ast.Name):
                   class_attributes.append({
                       "name": tgt.id,
                       "type": None,
                       "line": item.lineno,
                       "has_default": True,
                   })

   return {
       "name": node.name,
       "qualified_name": qname,
       "line_range": [node.lineno, getattr(node, "end_lineno", node.lineno)],
       "bases": [_unparse(b) for b in node.bases],
       "decorators": [_unparse(d) for d in node.decorator_list if _unparse(d)],
       "docstring": ast.get_docstring(node),
       "class_attributes": class_attributes,
       "methods": methods,
   }


def parse_file(filepath: Path, root: Path, strip_boilerplate: bool = True) -> Dict[str, Any]:
   """Parse a single Python file and return its indexed representation."""
   try:
       source = filepath.read_text(encoding="utf-8")
   except Exception as exc:
       return {
           "file": str(filepath.relative_to(root)).replace(os.sep, "/"),
           "error": f"ReadError: {exc}",
       }

   try:
       tree = ast.parse(source, filename=str(filepath))
   except SyntaxError as exc:
       return {
           "file": str(filepath.relative_to(root)).replace(os.sep, "/"),
           "error": f"SyntaxError: {exc.msg} (line {exc.lineno})",
       }

   module_docstring = ast.get_docstring(tree)
   imports: List[Dict[str, Any]] = []
   classes: List[Dict[str, Any]] = []
   functions: List[Dict[str, Any]] = []

   for child in ast.iter_child_nodes(tree):
       if isinstance(child, (ast.Import, ast.ImportFrom)):
           imports.extend(_extract_import(child))
       elif isinstance(child, ast.ClassDef):
           classes.append(_extract_class(child, "", strip_boilerplate))
       elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
           func = _extract_function(child, "", strip_boilerplate)
           if func is not None:
               functions.append(func)

   # Flatten call graph across module
   all_calls: set = set()
   for func in functions:
       all_calls.update(func["body_summary"]["calls"])
   for cls in classes:
       for meth in cls["methods"]:
           all_calls.update(meth["body_summary"]["calls"])

   return {
       "file": str(filepath.relative_to(root)).replace(os.sep, "/"),
       "module_docstring": module_docstring,
       "imports": imports,
       "classes": classes,
       "functions": functions,
       "calls": sorted(all_calls),
       "metrics": {
           "class_count": len(classes),
           "function_count": len(functions),
           "import_count": len(imports),
       },
   }


def index_directory(
   directory: Path,
   root: Path,
   strip_boilerplate: bool = True,
   excludes: Optional[set] = None,
) -> List[Dict[str, Any]]:
   """Recursively index all Python files under directory."""
   if excludes is None:
       excludes = DEFAULT_EXCLUDES.copy()
   else:
       excludes = DEFAULT_EXCLUDES | excludes

   modules: List[Dict[str, Any]] = []

   for path in sorted(directory.rglob("*.py")):
       if any(part in excludes for part in path.parts):
           continue
       modules.append(parse_file(path, root, strip_boilerplate))

   return modules


def main(argv: Optional[List[str]] = None) -> None:
   parser = argparse.ArgumentParser(
       description="Sovereign AST Parser — Index classes and functional contracts."
   )
   parser.add_argument(
       "path",
       type=Path,
       help="Python file or directory to scan.",
   )
   parser.add_argument(
       "--root",
       type=Path,
       default=None,
       help="Project root used for relative path output. Defaults to the parent of PATH if not provided.",
   )
   parser.add_argument(
       "--output",
       "-o",
       type=Path,
       default=None,
       help="Destination JSON file. Prints to stdout if omitted.",
   )
   parser.add_argument(
       "--strip-boilerplate",
       action=argparse.BooleanOptionalAction,
       default=True,
       help="Omit trivial pass / NotImplementedError stubs.",
   )
   parser.add_argument(
       "--exclude",
       action="append",
       default=[],
       help="Additional directory names to exclude (can be used multiple times).",
   )

   args = parser.parse_args(argv)

   target = args.path.resolve()
   root = args.root.resolve() if args.root else (target if target.is_dir() else target.parent)
   excludes = set(args.exclude) if args.exclude else set()

   if target.is_file():
       result = parse_file(target, root, args.strip_boilerplate)
       payload = {"modules": [result]}
   elif target.is_dir():
       modules = index_directory(target, root, args.strip_boilerplate, excludes)
       payload = {"modules": modules}
   else:
       print(f"Error: path not found — {target}", file=sys.stderr)
       sys.exit(1)

   json_out = json.dumps(payload, indent=2, ensure_ascii=False)

   if args.output:
       args.output.write_text(json_out, encoding="utf-8")
       print(f"Indexed {len(payload['modules'])} modules -> {args.output}", file=sys.stderr)
   else:
       print(json_out)


if __name__ == "__main__":
   main()
