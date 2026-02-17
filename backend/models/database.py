from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

from config import DATABASE_URL


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    audio_files = relationship("AudioFile", back_populates="project", cascade="all, delete-orphan")
    segments = relationship("Segment", back_populates="project", cascade="all, delete-orphan")


class AudioFile(Base):
    __tablename__ = "audio_files"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    original_name = Column(String)
    duration = Column(Float)
    sample_rate = Column(Integer)
    source_type = Column(String)  # 'youtube', 'upload', 'recording'
    source_url = Column(String)
    has_transcript = Column(Boolean, default=False)
    has_separation = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="audio_files")
    segments = relationship("Segment", back_populates="audio_file", cascade="all, delete-orphan")


class Segment(Base):
    __tablename__ = "segments"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    audio_id = Column(String, ForeignKey("audio_files.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    label = Column(Text, default="")
    sort_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="segments")
    audio_file = relationship("AudioFile", back_populates="segments")


engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
