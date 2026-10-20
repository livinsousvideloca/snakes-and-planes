# Breadboard Bench

Circuit calculators and a breadboard-style circuit builder that work in real, purchasable parts. Built to sit beside LTspice for an AC/DC circuits course: quick answers and part choices here, detailed simulation there.

Open `app/index.html` in a browser. There is no build step and no dependencies.

## What it does

**Breadboard.** A half-size breadboard (30 columns, 2.54 mm pitch, two rail pairs). Place resistors, capacitors, inductors, LEDs, DC supplies, AC sources, jumpers and a ground marker by clicking two holes. The circuit is solved with modified nodal analysis:

- DC operating point, with a piecewise LED model (Vf plus a small series resistance).
- AC phasors (rms) at any frequency, plus a 1 Hz to 1 MHz Bode plot at a chosen probe node.
- Rating checks: resistor wattage against a 50% derating guideline, LED forward current, capacitor working voltage, reversed electrolytics, inductor current.
- Wiring checks: shorted parts, dangling leads, shorted or parallel sources.
- LTspice-compatible SPICE netlist export.

**Calculators.** Ohm's law and power, resistor part finder, voltage divider designer, LED series resistor, series/parallel, RC/RL time constant, reactance and impedance, first-order filters, capacitor codes. Results snap to the chosen E-series.

## Standards

- IEC 60063:2015 preferred number series (E6 to E192).
- IEC 60062:2016 marking codes: resistor color bands, RKM codes (4k7, 2R2), 3-digit capacitor codes, EIA-96 SMD codes.
- IEC 60617 and IEEE 315 schematic symbols (switchable).

## Layout

- `app/index.html` – the user interface.
- `app/engine.js` – value handling, marking codes and the circuit solver. It has no DOM dependencies.
- `tests/engine.test.js` – solver and standards tests (`npm test`, Node 18 or later).
