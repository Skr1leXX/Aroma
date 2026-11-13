"use client";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState text="Не удалось загрузить раздел.">
      <Button onClick={reset}>Повторить</Button>
    </ErrorState>
  );
}
