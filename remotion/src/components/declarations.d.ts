import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // 1. Declare 'spline-viewer' as a valid HTML element in your JSX tree
      'spline-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          url?: string;
          'events-target'?: string;
        },
        HTMLElement
      >;
    }
  }
}
