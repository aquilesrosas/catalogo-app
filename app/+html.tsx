import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="es">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{
                    __html: `
                        html, body { background-color: #FAFAFA !important; margin: 0; padding: 0; }
                        #root { background-color: #FAFAFA; }
                        @keyframes _fadeIn {
                            from { opacity: 0; }
                            to   { opacity: 1; }
                        }
                        .page-fade { animation: _fadeIn 0.18s ease-out both; }
                    `
                }} />
            </head>
            <body>{children}</body>
        </html>
    );
}
