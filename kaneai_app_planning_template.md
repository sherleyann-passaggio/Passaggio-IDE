---
kanban_board: false
passaggio_template: true
yaml_type: HIDE
date_modified: true
kanban-plugin: basic
collaboration_urls:
  vault_viewer: "https://github.com/apps/passaggio-obsidian"
---

# KaneAI App Planning Template

> [!summary] Use this template to plan and verify a new client application using KaneAI's natural language testing capabilities.

---

## 1. Obsidian Frontmatter

Every new app note should include the following YAML frontmatter at the top of the file:

```yaml
---
kanban_board: false
passaggio_template: true
yaml_type: HIDE
date_modified: true, true
collaboration_urls:
  vault_viewer: "https://github.com/apps/passaggio-obsidian"
---
```

### Required Metadata Fields
- `kanban_board`: Boolean to toggle Kanban board rendering.
- `passaggio_template`: Boolean flag to identify Passaggio official templates.
- `yaml_type`: Visibility control for YAML comments.
- `date_modified`: Tracks last modification date.
- `collaboration_urls.vault_viewer`: Link to the Obsidian vault viewer.

---

## 2. App Scope & Core Workflows

Define the application's core purpose, user roles, and primary workflows.

### 2.1 App Scope
- **App Name**: [Enter App Name]
- **Client**: [Client Name]
- **Primary Objective**: [Brief description of the app's main goal]
- **Target Users**: [e.g., Admins, Customers, Internal Staff]
- **Key Features**: [List of top 3-5 features]
- **Tech Stack**: [e.g., React, Node.js, PostgreSQL]

### 2.2 Core Workflows
Map the primary user journeys that will be validated using KaneAI.

- [ ] **Onboarding Flow**: User signs up, verifies email, and completes profile.
- [ ] **Primary Action**: [e.g., Create a new project, Submit a form]
- [ ] **Secondary Action**: [e.g., Invite team members, Update settings]
- [ ] **Admin Workflow**: [e.g., Review submissions, Manage users]
- [ ] **Payment/Transaction Flow**: [If applicable]
- [ ] **Logout/Account Deletion**: User logs out or deletes their account.

---

## 3. KaneAI Natural Language "Test Commands"

> [!todo] Define your KaneAI Test Commands below. These are the natural language instructions that will be used to generate and execute your automated test suites.

### 3.1 Core Flow Examples

Provide three distinct KaneAI test commands for your application's core workflows.

#### Example 1: Login & Dashboard Access
```text
Test Command:
"As a registered user, log in with valid credentials, navigate to the main dashboard, and verify that the user's name and active projects are displayed correctly."
```

#### Example 2: Data Submission & Validation
```text
Test Command:
"Fill out the contact form with valid data, submit it, and confirm that a success message is displayed and the data appears in the admin panel within 5 seconds."
```

#### Example 3: Payment Processing
```text
Test Command:
"Add an item to the cart, proceed to checkout, complete the payment using test card details, and verify that the order confirmation page is displayed with the correct order ID."
```

---

## 4. KaneAI Verification & Run Checklist

Before running your KaneAI tests, ensure the following pre-conditions are met. After the run, verify the results.

### 4.1 Pre-Run Checklist
- [ ] **Test Environment**: The application is deployed to a stable staging environment accessible by KaneAI.
- [ ] **Test Data**: All required test users, data sets, and configurations are in place.
- [ ] **KaneAI Access**: The KaneAI agent has the necessary credentials and permissions to access the application.
- [ ]abilistic - [ ] **Feature Freeze**: No new code changes are being deployed during the test run.

### 4.2 Post-Run Verification
- [ ] **Test Results Review**: All KaneAI-generated test reports have been reviewed.
- [ ] **Bug Triage**: All identified failures and bugs have been triaged and assigned.
- [ ] **Regression Check**: No new critical issues were introduced in_injury previously working features.
- [ ] **Cross-Browser/Device Confirmation**: Results from the KaneAI test run are available for all target browsers and devices.
- [ ] **Documentation Update**: The application's documentation and test case library have been updated with the new KaneAI scenarios.

---

## 5. Additional Notes & Resources

Use this section for miscellaneous observations, links to relevant tickets, or other resources.

- **Notes**:
- **Jira Tickets**:
- **Design Mockups**:
- **API Documentation**:

---

> [!info] How to Use This Template in Obsidian
> 1. Create a new note in your Obsidian vault for each new client app.
> 2. Copy the YAML frontmatter to the top of the note.
> 3. Fill in the `App Scope` section to define project basics.
> 4. Use the `KaneAI Test Commands` section to draft your initial test scenarios in plain English.
> 5. Check off items in the `Verification & Run Checklist` as you progress through testing.
> 6. Use the `Additional Notes` section for any miscellaneous information.

#tag/kaneai #tag/app-planning #tag/obsidian-template