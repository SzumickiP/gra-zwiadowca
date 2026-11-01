# Gra Zwiadowca — wskazówki dla Claude

Przeglądarkowa gra zręcznościowa (łuk, noże, konie) w czystym HTML + Canvas, bez budowania i zależności.
Odpowiadaj po polsku. Commit i push rób tylko na wyraźną prośbę użytkownika.

## Pliki

- `index.html` — cała gra (~4600 linii): style, HTML z opisem zasad („Jak grać”, akapit na planszę) i jeden `<script>` w IIFE.
- `wyniki.html` — tabela wyników z `localStorage` (`TOTAL_BOARDS = 48`).
- `404.html` — na GitHub Pages przekierowuje `/test/N` na `index.html?test=N`.
- `README.md`, `fonts/` (Cinzel, EB Garamond, licencja OFL), `favicon.svg`.
- `tests/` — testy w przeglądarce headless (patrz niżej).
- Publikacja: GitHub `SzumickiP/gra-zwiadowca`, gałąź `main` → https://szumickip.github.io/gra-zwiadowca/

## Budowa gry

- Scena 820 × 440, ziemia `GY = 362`, łucznik `ARCHER_X = 112`, 60 kroków logiki na sekundę (`update()`), rysowanie w `draw()`.
- Zmienna `level` (1–12) to numer planszy, `tier` (1–4) to poziom. 4 poziomy × 12 plansz; na wyższym poziomie celownik łuku jest krótszy.
- Każda plansza ma: `startLevelN()`, logikę (`updateLevelN` albo gałąź w `update()`), rysowanie (`drawLevelN` albo gałąź w `draw()`), ocenę na koniec (`xxxRank`), `endLevelN` → `finishBoard()`, rekord `LVLN_BEST_KEY`.
- Dodając planszę, trzeba też: zwiększyć `BOARDS`, dopisać start do `startBoard()`, rank do tablicy w `drawOver()` i wynik maksymalny (`small`), komunikat „PLANSZA N ODBLOKOWANA” w `drawOver()`, przejście w `pointerdown` (`level === N-1 && unlocked`), akapit w „Jak grać”, `TOTAL_BOARDS` w `wyniki.html` i README.
- Fazy (`phase`): `ready`, `aiming`, `flight`, `landed`, `over`, oraz własne: `kflight` (nóż), `ride` (plansza 8), `reload` (plansza 12).
- Strzał: przytrzymaj mysz, odciągnij od celu, puść (`aimNow`, `release`, `stepArrow`, `land`, `finishShot`). Punkt strzału z `shoulderPt()`; `archerLift()` podnosi łucznika (siodło, palisada).
- Tryb testowy: `index.html?test=N` startuje planszę N bez imienia i bez zapisu wyników.
- Komentarze w kodzie po polsku, krótkie.

## Plansze

1. Strzelnica (5 strzał, zaliczenie 40/50) · 2. Rzut nożem w znikające tarcze · 3. Znikające tarcze z łuku.
4. Mroczniaki (płonące strzały, skaczą między skałami) · 5. Jeźdźcy (pochylanie, koń pada po 3 trafieniach, strzelają co 5 s).
6. Wilczury (kryjówki, kucanie, zasłanianie głowy) · 7. Bitwa (3 bronie: ostra, płonąca, nóż; klawisze 1–3).
8. Konna jazda: 15 przeszkód (10 kłód + 5 rowów losowo), skok W, +10% prędkości po udanym skoku, zaliczenie 12/15.
9. Pościg: świat planszy 5 rysowany w lustrzanym odbiciu (`mirrored`, `toScene` odbija mysz); 5 jeźdźców, najwyżej 2 naraz, trafiają dopiero od połowy sceny; 12 strzał.
10. Strzelnica w galopie: 8 tarcz przy drodze, 2 kłody losowo (W albo przycisk SKOK), 8 strzał, zaliczenie 56/80.
11. Obrona palisady: bitwa z planszy 7 (`isBattle()` = plansza 7 lub 11), łucznik na palisadzie, 8 wrogów + taran (tylko płonąca strzała), brama 3 HP.
12. Czarny Pan: 3 fazy, trafienie tylko w świecącą szczelinę (gdy unosi miecz/tarczę) albo w głowę po strąceniu hełmu (3 trafienia); pomocnicy wilczur → jeździec → wilczur; ostrze cienia −10. Łucznik: 2 kołczany × 12 strzał (1), 3 noże (2), saksa 3 ciosy wręcz (3), tarcza bez limitu — odbija czar i odpycha bliskiego wroga (4). Stan w obiekcie `kit`.

## Nazwy i prawo

Gra jest inspirowana „Zwiadowcami”, ale używa wyłącznie własnych nazw: mroczniaki, wilczury, jeźdźcy (stepowi), Dębowy Gród, Czarny Pan, mistrz/nauczyciel. Nie wprowadzaj nazw z książek (Halt, Will, kalkary, wargale, Temudżeini, Redmont, Morgarath, Araluen). W kodzie zostały stare identyfikatory (`kalkar`, `wargal`, `rider`) — gracz ich nie widzi, nie zmieniaj ich.
Nie zmieniaj kluczy `localStorage` (`zwiadowcy-…-rekord`, `zwiadowcy-wyniki`, `zwiadowcy-gracz`) — gracze straciliby rekordy.

## Testy

Wymagają Node 22+ i Chromium z Playwrighta (`%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-*`, albo zmienna `CHROME`). Skrypty same uruchamiają serwer plików na porcie 8765.

- `node tests/smoke.mjs` — wszystkie strony i plansze 1–12 bez błędów w konsoli, zrzuty w `tests/out/`.
- `node tests/board11.mjs`, `node tests/board12.mjs` — scenariusze plansz 11 i 12.
- `tests/harness.mjs`: `open(url)` zwraca obiekt z `game(kod)` (wykonuje kod w zasięgu gry przez debugger, np. `return boss.hp;` albo zmiana kolejki wrogów), `shot`, `drag`, `click`, `key`; `solve()` liczy kąt i siłę strzału do (ruchomego) celu, `dragFor()` zamienia je na przeciągnięcie myszy.
- Po zmianach w grze uruchom co najmniej `node tests/smoke.mjs` i obejrzyj zrzuty zmienionej planszy.
