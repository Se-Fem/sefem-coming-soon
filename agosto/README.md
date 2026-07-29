# Se Fem? · Agosto in Ticino — prototipo statico

Prototipo HTML/CSS/JavaScript compatibile con GitHub Pages.

## Funzioni
- caricamento eventi da JSON locale;
- sezione Mese x MeSe;
- eventi Mese x MeSe e Selecta in evidenza;
- ricerca e filtri client-side;
- lista cronologica responsive;
- dettaglio full screen con URL `?evento=slug`;
- pulsante indietro del browser supportato;
- nessun backend o framework richiesto.

## Avvio locale
Il browser non consente sempre di caricare JSON aprendo direttamente `index.html`. Avviare un server statico:

```bash
python3 -m http.server 8080
```

Poi aprire `http://localhost:8080`.

## Pubblicazione GitHub Pages
Copiare i file nella cartella pubblicata dal repository (`/`, `/docs` oppure branch `gh-pages`). Non sono richieste regole di rewrite.

## Aggiornare gli eventi
Modificare `assets/data/events-2026-08.json`. Gli eventi demo, tranne Monte Generoso, servono solo per valutare il layout.
