export default function PendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 px-4 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">
        Your account is pending approval
      </h1>
      <p className="max-w-md text-sm text-neutral-600">
        Your account has been created. An HOA administrator will verify your
        resident status shortly. You&apos;ll be able to access the document
        assistant as soon as you&apos;re approved — no further action
        needed on your end.
      </p>
    </div>
  );
}
