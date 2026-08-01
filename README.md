# AperiPost(umi) — beta

Party game installabile su iPhone, iPad, Android e computer. Funziona anche
offline e comprende 7 mazzi e 280 carte.

## Apri l'app

**[Avvia AperiPost(umi)](https://madstoryteller11.github.io/aperipostumi/)**

La beta è pubblica soltanto per facilitare i test. `robots.txt` chiede ai
motori di ricerca di non indicizzarla.

## Come proporre una carta alternativa

Durante una partita:

1. Quando trovi una carta da migliorare, premi **Non mi sembra interessante**.
2. Nel campo **Testo alternativo**, riscrivi la carta come vorresti leggerla.
3. Mantieni variabili come `{player1}`, `{player2}` e `{sips}` quando servono.
4. Premi **Proponi e cambia carta**.
5. Continua a giocare e ripeti la procedura per tutte le carte che vuoi
   migliorare.

Non vengono richiesti nome, soprannome, motivazione o note: basta proporre il
nuovo testo.

## Come esportare e inviare il feedback

Le proposte restano sul dispositivo e non vengono inviate automaticamente.
Al termine del test:

1. Apri **Dati** dal menu in alto.
2. Controlla il numero di proposte raccolte.
3. Premi **Esporta feedback JSON**.
4. Il dispositivo scaricherà un file con nome simile a
   `aperipostumi-feedback-install-...-2026-07-30.json`.
5. Invia quel file alla persona che ti ha condiviso il link dell'app, usando
   lo stesso canale (WhatsApp, Telegram, email, Drive e così via).

Il file JSON contiene le carte originali e i testi alternativi proposti. Non
contiene il nome del tester.

> Importante: esporta il JSON prima di cancellare i dati del browser,
> disinstallare la PWA o cambiare dispositivo.

## Come raccogliere più file JSON

Chi coordina il beta test può unire i feedback ricevuti:

1. Apri l'app e vai in **Dati**.
2. Premi **Importa e unisci JSON**.
3. Seleziona uno o più file ricevuti dai tester.
4. L'app unisce le proposte ed evita i duplicati con lo stesso identificativo.
5. Usa **Esporta feedback JSON** per salvare un archivio unico aggiornato.

## Installazione e pubblicazione

- [Installazione su iPhone e Android](INSTALLAZIONE_IPHONE_ANDROID.md)
- [Pubblicazione con GitHub Pages](PUBBLICAZIONE_GITHUB_PAGES.md)
- [Messaggio pronto per invitare i beta tester](MESSAGGIO_BETA_TESTER.md)

Il codice dell'app si trova in `www`. Il workflow GitHub Pages pubblica
automaticamente la cartella a ogni aggiornamento di `main`.
