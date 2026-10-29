import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          allowpopups?: string;
          partition?: string;
          preload?: string;
          httpreferrer?: string;
          useragent?: string;
          disablewebsecurity?: string;
          nodeintegration?: string;
        },
        HTMLElement
      >;
    }
  }
}
