# Breadboard Bench

Circuit calculators and a breadboard-style circuit builder that work in real, purchasable parts. Built to sit beside LTspice for an AC/DC circuits course: quick answers and part choices here, detailed simulation there.

Open `app/index.html` in a browser. There is no build step and no dependencies.

## What it does

**Breadboard.** A half-size breadboard (30 columns, 2.54 mm pitch, two rail pairs). The top ribbon has one button per kind of part (resistor, capacitor, LED, transistor, op-amp, regulator…) plus a part-number search. Picking one opens the inspector row underneath. By default it is a learning view: a one-line explanation of what the part does, how to put it in, a few plain choices (for example NPN or PNP) and common values to click. Tick "Real-part details" to choose among every catalog part with its tolerance and ratings. Either way you set the part up before placing it; the same row edits a placed part when you click it. Two-lead parts go between two holes; TO-92, TO-220, trimmers and DIP-8 chips drop in with one click using their real pinouts.

The library has real parts with datasheet ratings: carbon film, metal film, metal oxide and wirewound resistors; C0G, X7R, film and electrolytic capacitors; axial and power inductors; trimmers and panel pots; slide switches and push buttons; bench supply with current limit, 9 V, AA pack, USB and CR2032 cells, function generator; 1N4148, 1N400x, 1N5819 and 1N47xx Zener diodes; LEDs in seven colors; 2N3904, 2N2222A, BC547B, 2N3906, BC557B, 2N7000, IRLZ44N; LM358, TL072, NE5532, MCP6002, LM741 op-amps; L7805, L7812, LM317 and LM1117-3.3 regulators.

The circuit is solved with modified nodal analysis and Newton–Raphson (with source and gmin stepping as fallbacks):

- DC operating point. Diodes and LEDs use the Shockley equation with series resistance and Zener breakdown; BJTs a simplified Gummel–Poon model; MOSFETs a square-law model; op-amps a rail-limited gain stage with output current limit; regulators a reference with dropout and current limit; batteries and bench supplies their internal resistance or current limit.
- AC phasors (rms) at any frequency, linearized at the DC operating point (op-amps include their GBW pole), plus a 1 Hz to 1 MHz Bode plot at a chosen probe node.
- Rating checks against each part's datasheet limits: wattage, forward and reverse current and voltage, Vce, Vgs, Id, dissipation, op-amp supply range and clipping, regulator dropout and heat.
- Wiring checks: shorted parts, dangling leads, shorted pins, unused op-amp units, shorted or parallel sources.
- LTspice-compatible SPICE netlist export, with .model and .subckt lines for every semiconductor and IC.

**Look.** Dark, warm Art Deco styling (ebony, brass and ivory, sunburst backdrop, stepped corners) with glass panels and soft glow.

**Sample circuits.** Fourteen worked examples from a typical AC/DC course, grouped by topic: LED and divider basics, a loaded divider, superposition with two sources, a Wheatstone bridge, RC high-pass and series RLC resonance, a Zener reference, BJT and MOSFET switches, a common-emitter amplifier, non-inverting and inverting op-amp amplifiers, and 7805 and LM317 regulators. Each one explains what the circuit shows, what the readings should say, and what to change next. A test checks every sample against the numbers in its write-up.

**Calculators.** Ohm's law and power, resistor part finder, voltage divider designer, LED series resistor, series/parallel, RC/RL time constant, reactance and impedance, first-order filters, capacitor codes. Results snap to the chosen E-series.

## Standards

- IEC 60063:2015 preferred number series (E6 to E192).
- IEC 60062:2016 marking codes: resistor color bands, RKM codes (4k7, 2R2), 3-digit capacitor codes, EIA-96 SMD codes.
- IEC 60617 and IEEE 315 schematic symbols (switchable).

## Layout

- `app/index.html` – the user interface.
- `app/engine.js` – value handling, marking codes and the circuit solver. It has no DOM dependencies.
- `tests/engine.test.js` – solver and standards tests; `tests/devices.test.js` – device models against datasheet behaviour and a random-circuit convergence check (`npm test`, Node 18 or later).
