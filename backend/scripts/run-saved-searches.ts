import { checkSavedSearches } from "../src/jobs/saved-search.job";

checkSavedSearches()
  .then(() => {
    console.log("Saved search check complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

  