"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const [errorDetails, setErrorDetails] = useState<any>({});

  useEffect(() => {
    // Get all URL parameters
    const params: any = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    setErrorDetails(params);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Authentication Error
            </h2>
            <div className="text-red-600 mb-6">
              <p className="text-lg font-semibold">
                There was an error during authentication
              </p>
            </div>
          </div>

          {/* Error Details */}
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Error Details:
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              {Object.keys(errorDetails).length > 0 ? (
                Object.entries(errorDetails).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-mono font-medium text-gray-600 min-w-[120px]">
                      {key}:
                    </span>
                    <span className="font-mono text-gray-800 break-all">
                      {String(value)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No error parameters found</p>
              )}
            </div>
          </div>

          {/* Common Error Explanations */}
          <div className="bg-blue-50 p-4 rounded-md mb-6">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Common Error Explanations:
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <div>
                <strong>error=access_denied:</strong> User cancelled the authentication process
              </div>
              <div>
                <strong>error=invalid_request:</strong> The request was malformed or missing required parameters
              </div>
              <div>
                <strong>error=server_error:</strong> An internal server error occurred
              </div>
              <div>
                <strong>error=temporarily_unavailable:</strong> The service is temporarily unavailable
              </div>
              <div>
                <strong>error=unauthorized_client:</strong> The client is not authorized to request an authorization code
              </div>
            </div>
          </div>

          {/* Debug Information */}
          <div className="bg-yellow-50 p-4 rounded-md mb-6">
            <h3 className="text-sm font-medium text-yellow-900 mb-2">
              Debug Information:
            </h3>
            <div className="text-sm text-yellow-800 space-y-1">
              <div>Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</div>
              <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</div>
              <div>Timestamp: {new Date().toISOString()}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go Home
            </Link>
          </div>

          {/* Copy Error Details Button */}
          <div className="mt-4">
            <button
              onClick={() => {
                const errorText = JSON.stringify(errorDetails, null, 2);
                navigator.clipboard.writeText(errorText);
                alert('Error details copied to clipboard!');
              }}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Copy Error Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <AuthCodeErrorContent />
    </Suspense>
  );
} 