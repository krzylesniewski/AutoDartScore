# CheckoutCard

Karta zamknięcia na dole lewej kolumny ekranu gry: najmocniejszy kolor ekranu, widoczna tylko wtedy, gdy wynik da się zamknąć w rzutkach, które zostały w turze.

- Tło: gradient 135° `color-accent-hi` → `color-accent` (60%) → `color-accent-lo`, `shadow-checkout`, `radius-card`, tarcza w rogu przy `opacity-checkout-rings` w `color-on-accent`.
- Etykieta „ZAMKNIĘCIE W 3 RZUTKACH” w `label-on-accent` (19 px 700, bo `color-on-accent` ma 3,6:1 na jasnym końcu gradientu).
- Trasa: każda rzutka w osobnym chipie `.sc-route-chip` (`color-route-chip`, `radius-chip`) w stylu `route`, bez łamania linii. Na węższych ekranach rozmiar skaluje się przez `cqi`, jak chip `ROUTE_CHIP` z P55.
- Cała karta to przycisk: dotknięcie albo Enter wpisuje pierwszą rzutkę trasy (`aria-keyshortcuts="Enter"`, znaczek `.sc-kbd--on-accent` „Enter” na tle `color-route-chip`). `aria-label` czyta trasę i akcję.
- Bez trasy karta zostawia puste miejsce tej samej wysokości (klawiatura nie skacze, P31).
- Ten sam chip trasy w treningu „Końcówki”.

Dostarczasz: trasę zamknięcia i liczbę rzutek do końca tury.
