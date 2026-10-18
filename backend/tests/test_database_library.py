import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, User
from app.routers.database_library import (
    create_database_library_entry,
    delete_database_library_entry,
    get_database_library,
    update_database_library_entry,
)
from app.schemas import DatabaseLibraryEntryCreate, DatabaseLibraryEntryResponse


class DatabaseLibraryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.teacher = User(id="teacher", email="teacher@example.test", hashed_password="x", name="Teacher", initials="T", role="instructor")
        self.other_teacher = User(id="other", email="other@example.test", hashed_password="x", name="Other", initials="O", role="instructor")
        self.student = User(id="student", email="student@example.test", hashed_password="x", name="Student", initials="S", role="student")
        self.db.add_all([self.teacher, self.other_teacher, self.student])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_instructor_can_create_update_list_and_delete_own_entry(self):
        payload = DatabaseLibraryEntryCreate(
            title="  Sales DB  ",
            createTableSql="CREATE TABLE Customers (Id INT PRIMARY KEY)",
            insertIntoSql="INSERT INTO Customers VALUES (1)",
        )
        created = create_database_library_entry(payload, self.db, self.teacher)
        self.assertEqual(created.title, "Sales DB")
        self.assertEqual(created.database_file_name, "salesdb.sql")
        self.assertEqual(created.create_table_file_name, "salesdb_createtable.sql")
        self.assertEqual(created.insert_into_file_name, "salesdb_insertdata.sql")
        self.assertEqual(created.create_table_sql, "CREATE TABLE Customers (Id INT PRIMARY KEY)")
        self.assertEqual(created.insert_into_sql, "INSERT INTO Customers VALUES (1)")
        self.assertEqual(created.datasets, [{"fileName": "salesdb_insertdata.sql", "sql": "INSERT INTO Customers VALUES (1)"}])

        updated = update_database_library_entry(
            created.id,
            DatabaseLibraryEntryCreate(title="Sales v2", createTableSql="CREATE TABLE Orders (Id INT)", insertIntoSql=""),
            self.db,
            self.teacher,
        )
        self.assertEqual(updated.title, "Sales v2")
        self.assertEqual(updated.database_file_name, "salesv2.sql")
        self.assertEqual(updated.insert_into_sql, "")
        self.assertEqual([entry.id for entry in get_database_library(self.db, self.teacher)], [created.id])

        delete_database_library_entry(created.id, self.db, self.teacher)
        self.assertEqual(get_database_library(self.db, self.teacher), [])

    def test_entries_are_scoped_to_the_instructor_and_students_are_rejected(self):
        created = create_database_library_entry(DatabaseLibraryEntryCreate(title="Private SQL"), self.db, self.teacher)
        self.assertEqual(get_database_library(self.db, self.other_teacher), [])
        with self.assertRaises(HTTPException) as raised:
            update_database_library_entry(created.id, DatabaseLibraryEntryCreate(title="Changed"), self.db, self.other_teacher)
        self.assertEqual(raised.exception.status_code, 404)
        with self.assertRaises(HTTPException) as raised:
            get_database_library(self.db, self.student)
        self.assertEqual(raised.exception.status_code, 403)

    def test_name_must_not_be_blank(self):
        with self.assertRaises(ValueError):
            DatabaseLibraryEntryCreate(title="   ")

    def test_filenames_can_be_customized_and_always_keep_sql_extension(self):
        generated = DatabaseLibraryEntryCreate(title="Thư viện sách")
        self.assertEqual(generated.database_file_name, "thuviensach.sql")
        self.assertEqual(generated.create_table_file_name, "thuviensach_createtable.sql")

        entry = DatabaseLibraryEntryCreate(
            title="Thư viện sách",
            databaseFileName="thuviensach.sql",
            createTableFileName="tables",
            insertIntoFileName="book_seed.SQL",
        )
        self.assertEqual(entry.database_file_name, "thuviensach.sql")
        self.assertEqual(entry.create_table_file_name, "tables.sql")
        self.assertEqual(entry.insert_into_file_name, "book_seed.sql")

    def test_filenames_reject_paths(self):
        with self.assertRaises(ValueError):
            DatabaseLibraryEntryCreate(title="Books", databaseFileName="../books")

    def test_multiple_datasets_are_persisted_and_returned_with_individual_filenames(self):
        payload = DatabaseLibraryEntryCreate(
            title="Books",
            createTableSql="CREATE TABLE Books (Id INT)",
            datasets=[
                {"fileName": "seed_1.sql", "sql": "INSERT INTO Books VALUES (1)"},
                {"fileName": "seed_2", "sql": "INSERT INTO Books VALUES (2)"},
            ],
        )
        created = create_database_library_entry(payload, self.db, self.teacher)
        response = DatabaseLibraryEntryResponse.model_validate(created)

        self.assertEqual(created.insert_into_file_name, "seed_1.sql")
        self.assertEqual(created.insert_into_sql, "INSERT INTO Books VALUES (1)")
        self.assertEqual(
            [dataset.model_dump(by_alias=True) for dataset in response.datasets],
            [
                {"fileName": "seed_1.sql", "sql": "INSERT INTO Books VALUES (1)"},
                {"fileName": "seed_2.sql", "sql": "INSERT INTO Books VALUES (2)"},
            ],
        )


if __name__ == "__main__":
    unittest.main()
