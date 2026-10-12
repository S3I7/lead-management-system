"""initial_writathon_schema

Revision ID: ab4982986f48
Revises: 
Create Date: 2026-10-06 11:59:56.099187

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ab4982986f48'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from app.models.entities import Base
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    """Downgrade schema."""
    from app.models.entities import Base
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, checkfirst=True)
