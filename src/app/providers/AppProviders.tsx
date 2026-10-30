import { useState, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageConfigProvider } from "@/features/fontSettings";
import { NotificationToastContainer } from "./NotificationToastContainer";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageConfigProvider>
        <BrowserRouter>
          {children}
          <NotificationToastContainer />
        </BrowserRouter>
      </LanguageConfigProvider>
    </QueryClientProvider>
  );
}

