import { useEffect } from "react";

/** If filters or actions shrink the result set below the current page, step back to the last real page. */
export function useClampPage(totalPages: number | undefined, page: number, setPage: (p: number) => void) {
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);
}