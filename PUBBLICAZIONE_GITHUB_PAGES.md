# Pubblicazione su GitHub Pages

Repository: `madstoryteller11/aperipostumi`
App: <https://madstoryteller11.github.io/aperipostumi/>

## Configurazione

1. Apri **Settings → Pages** nel repository.
2. In **Build and deployment**, seleziona **GitHub Actions**.
3. Controlla ogni pubblicazione nella scheda **Actions**.

Il workflow `.github/workflows/deploy-pages.yml` pubblica la cartella `www` a
ogni aggiornamento del branch `main`.

## Raccolta dei feedback

I feedback non vengono trasmessi a un server: rimangono nel browser o nella
PWA del tester.

Ogni tester deve:

1. proporre i testi alternativi durante la partita;
2. aprire **Dati**;
3. premere **Esporta feedback JSON**;
4. inviare il file JSON al responsabile del beta test.

Il responsabile può aprire **Dati → Importa e unisci JSON**, selezionare anche
più file contemporaneamente ed esportare un archivio JSON unico.

Il messaggio da condividere insieme al link è disponibile in
`MESSAGGIO_BETA_TESTER.md`.
