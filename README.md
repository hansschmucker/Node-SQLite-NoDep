# Node-SQLite

__Node-SQLite__

Node-SQLite is a very simplistic abstraction layer for the sqlite3 shell application. While full integration using something like
node-sqlite3 is usually preferable, there are cases when a simple, portable solution is preferable. Node-SQLite requires nothing
but the plain node.exe and sqlite3.exe files. No NPM, nothing. Just these two EXE files.

__Limitations__

Error reporting is a bit broken. SQL errors are therefore reported directly to console.error.

Handling of character \u0000 is broken in sqlite3.exe, so Node-SQLite replaces it with \u0020 automatically.

Characters \u0003 and \u0004 are used as delimiters for sqlite3.exe output,so any statements will have them replaced with \u0020 automatically.
