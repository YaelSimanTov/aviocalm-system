CREATE TABLE "anxiety_profiles" (
    "LogID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SessionID" UUID NOT NULL,
    "RecordedAt" TIMESTAMP NOT NULL,
    "VrState" VARCHAR(50) NOT NULL,
    "Difficulty" VARCHAR(50) NOT NULL,
    "HeartRate" INTEGER,
    "StressScore" INTEGER,
    "SpO2" INTEGER,
    "TherapistAction" VARCHAR(50) DEFAULT 'None'
);

