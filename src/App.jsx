import { useEffect, useState } from 'react';
import { SimilarFontTab } from '@/components/SimilarFontTab.jsx';
import { FontPairTab } from '@/components/FontPairTab.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function App() {
  const [localFontsSupported, setLocalFontsSupported] = useState(null);

  useEffect(() => {
    setLocalFontsSupported('queryLocalFonts' in window);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="space-y-2 px-6 pb-4 pt-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">fontPair</h1>
        <p className="text-muted-foreground">Similarity checker &amp; font pairing tool</p>
        {localFontsSupported !== null && (
          <Badge variant={localFontsSupported ? 'success' : 'warning'} className="font-normal">
            {localFontsSupported
              ? 'Local Font Access disponibile in questo browser.'
              : "Il tuo browser non supporta l'accesso ai font locali (serve Chrome o Edge) — puoi comunque caricare i file dei font."}
          </Badge>
        )}
      </header>

      <main className="container max-w-[1200px] 2xl:max-w-[1680px]">
        <Tabs defaultValue="similar">
          <div className="mb-5 flex justify-center">
            <TabsList>
              <TabsTrigger value="similar">Similar Font</TabsTrigger>
              <TabsTrigger value="pair">Font Pair</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="similar" className="mt-0">
            <SimilarFontTab />
          </TabsContent>
          <TabsContent value="pair" className="mt-0">
            <FontPairTab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="px-4 pb-12 pt-8 text-center text-xs text-muted-foreground">
        <p>
          Font locali via{' '}
          <a className="underline" href="https://developer.chrome.com/docs/capabilities/web-apis/local-fonts" target="_blank" rel="noopener noreferrer">
            Local Font Access API
          </a>{' '}
          (solo Chrome/Edge) · Google Fonts caricati live · nessun font viene scaricato da foundry esterne.
        </p>
      </footer>
    </div>
  );
}
