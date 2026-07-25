"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast, Toaster } from "sonner";

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const [errorDetails, setErrorDetails] = useState<Record<string, string>>({});

  useEffect(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    setErrorDetails(params);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <Toaster position="top-center" richColors />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-lg border border-border bg-surface py-8 px-4 sm:px-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Authentication Error
            </h2>
            <p className="text-sm text-status-negative mb-6">
              There was an error during authentication
            </p>
          </div>

          {/* Error Details */}
          <div className="rounded-lg border border-border bg-surface-2 p-4 mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Error Details
            </h3>
            <div className="text-sm space-y-1">
              {Object.keys(errorDetails).length > 0 ? (
                Object.entries(errorDetails).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-mono font-medium text-muted-foreground min-w-[100px] shrink-0">
                      {key}:
                    </span>
                    <span className="font-mono text-foreground break-all">
                      {String(value)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground italic">No error parameters found</p>
              )}
            </div>
          </div>

          {/* Common Error Explanations */}
          <div className="rounded-lg border border-accent/30 bg-accent-muted p-4 mb-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-accent mb-2">
              Common Error Explanations
            </h3>
            <div className="text-sm space-y-2 text-foreground/90">
              <div><strong>access_denied:</strong> User cancelled the authentication process</div>
              <div><strong>invalid_request:</strong> The request was malformed or missing required parameters</div>
              <div><strong>server_error:</strong> An internal server error occurred</div>
              <div><strong>temporarily_unavailable:</strong> The service is temporarily unavailable</div>
              <div><strong>unauthorized_client:</strong> The client is not authorized to request an authorization code</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Link
              href="/login"
              className="w-full flex justify-center py-2 px-4 rounded-md text-sm font-medium text-accent-foreground bg-accent hover:bg-accent-hover transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="w-full flex justify-center py-2 px-4 rounded-md border border-border-strong text-sm font-medium text-foreground bg-surface-2 hover:bg-surface-3 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
            >
              Go Home
            </Link>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
                toast.success("Error details copied to clipboard");
              }}
              className="w-full flex justify-center py-2 px-4 rounded-md border border-border-strong text-sm font-medium text-foreground bg-surface-2 hover:bg-surface-3 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
            >
              Copy Error Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <AuthCodeErrorContent />
    </Suspense>
  );
}
