-- Old 64-bit hashes keep their picture part; the colour part is zero-filled.
ALTER TABLE "images" ALTER COLUMN "phash" SET DATA TYPE bit(256) USING (phash::text || repeat('0', 192))::bit(256);