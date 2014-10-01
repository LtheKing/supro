СУПРО (supro)
=====

**С**истема **У**правления **ПРО**дажами

A multiuser, distributed, web-based platform with comprehensible
ideas and amount of code to just start developing desktop-like
applications that help an organization running its business.
(E.g. mini-ERP like MS Excel/VBA).

developer's POV:

* Node.JS 0.10, connect 2.9, ExtJS 4.2

* simple config and robust start/stop scripts
 (on MS Windows via `node-webkit` run `node` w/o CLI, others by sh/init.d)

* modular (and has minimal set of dependencies)

* simple localization

* rapid development, code-as-you-go for both UI and backend logic;
  reloading of UI component (view + controller + l10n) reloads its API handlers

* only business logic like in VBA/MS Excel (or similar IDEs)

* rich UI (components framework)

* simple req/res API (CRUD with manual if-based routing). Supports `Ext.data.Store` contract.

user's POV:

* MDI, shortcuts to launch app modules, top status bar

* user login/authentication with session

* authorization of API (and its UI components) by ACL or RBAC (as app module)

* user status maintained in actual online/offline UI state (away, busy, etc.)

* basic user communication by chat app

Please see wiki for links and more info.

**С**истема **У**правления **П**родажами **Р**азмеров **О**буви / **О**дежды
