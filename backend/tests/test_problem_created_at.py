import unittest
from datetime import datetime
from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session
from app.database import Base
from app.models import Problem
from app.schemas import ProblemListResponse


class ProblemCreationDateTests(unittest.TestCase):
    def test_creation_date_is_preserved_and_unknown_dates_stay_empty(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            before = datetime.utcnow()
            problem = Problem(id="date-test", number="001", title="Original", difficulty="Easy",
                              description="Statement", requirements="Requirements")
            db.add(problem)
            db.commit()
            created = problem.created_at
            self.assertGreaterEqual(created, before)
            problem.title = "Edited"
            db.commit()
            self.assertEqual(problem.created_at, created)
            payload = ProblemListResponse.model_validate(problem).model_dump(mode="json", by_alias=True)
            self.assertEqual(payload["createdAt"], created.isoformat())
            db.execute(update(Problem).where(Problem.id == problem.id).values(created_at=None))
            db.commit()
            db.refresh(problem)
            self.assertIsNone(ProblemListResponse.model_validate(problem).created_at)
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
