export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 px-4 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">
        Access not approved
      </h1>
      <p className="max-w-md text-sm text-neutral-600">
        This account was not approved for access to the resident document
        assistant. If you believe this is a mistake, please contact the HOA
        Board directly.
      </p>
    </div>
  );
}
