#!/bin/bash
DB="backend/prisma/dev.db"
TABLES=("fornitori" "marchi" "categorie" "regole_markup" "mappatura_campi" "mappatura_categorie")

echo "BEGIN;" > migration.sql
for TABLE in "${TABLES[@]}"; do
    sqlite3 "$DB" ".mode insert $TABLE" "SELECT * FROM $TABLE;" >> migration.sql
done
echo "COMMIT;" >> migration.sql
