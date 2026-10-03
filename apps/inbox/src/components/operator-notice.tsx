import Link from "next/link";

export const OPERATOR_LOCKED = "Operator unlock required.";
export const OPERATOR_HINT = "Operator unlock required — unlock at /operator";

export function isOperatorLocked(message: string | null | undefined): boolean {
  return message === OPERATOR_LOCKED;
}

/** Renders an API error, turning the operator 401 into a link to the unlock screen. */
export function ErrorText({ message }: { message: string }) {
  if (!isOperatorLocked(message)) return <>{message}</>;
  return (
    <>
      Operator unlock required — unlock at{" "}
      <Link href="/operator" className="font-semibold underline underline-offset-2">
        /operator
      </Link>
    </>
  );
}
