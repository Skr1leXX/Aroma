import { db } from "@/db";
import { seed } from "@/db/seed";

seed(db)
  .then(() => console.log("Seed complete"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
