# Edizione Scientifica Digitale — Carteggio Canneti-Fiacchi

EVT 2.0 viewer for the digital edition of the correspondence between Pietro Canneti
(1659–1730) and Mariangelo Fiacchi (1688–1777), Camaldolese monks involved in the
formation of the Biblioteca Classense in Ravenna (1711–1730).

Part of the **DigiLetClass** project, funded by PNRR-CHANGES (Spoke 3: Cultural Heritage).

---

## Repository structure

```
carteggio-canneti-fiacchi-esd/
├── evt-viewer/          # EVT 2.0 application
│   ├── app/
│   │   ├── data/        # converted TEI/XML
│   │   └── config/      # EVT configuration
└── README.md
```

Data source: [`carteggio-canneti-fiacchi-data`](https://github.com/chiarasharp/carteggio-canneti-fiacchi-data)

---

## Development setup

```bash
cd evt-viewer
nvm use 14
npm install
npm install --only=dev
npm start        
```

Requirements: Node.js 14 (via nvm), npm 6.

---

## Corpus

| Busta | Letters | Status |
|---|---|---|
| Busta 10 | E10001–E10133 | Complete |
| Busta 11 | E11001–E11060 | Published — markup complete |
| Busta 11 | E11061–E11141 | Stubs only — not yet published |

---

![Testata PNRR](testata-pnrr.png "Testata PNRR")

Il progetto è finanziato dall'Unione Europea - NextGenerationEU a valere sul Piano
Nazionale di Ripresa e Resilienza (PNRR) – Missione 4 Istruzione e ricerca –
Componente 2 Dalla ricerca all'impresa – Investimento 1.3, Avviso D.D. 341 del
15/03/2022, Cultural Heritage Active Innovation for Sustainable Society,
codice proposta PE0000020 CUP [J33C22002850006].
