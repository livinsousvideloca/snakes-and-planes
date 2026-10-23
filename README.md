# Breadboard Bench

A study bench for ELT 1206 (AC/DC fundamentals): build a circuit on a breadboard, read the meters, and check the math. Built to sit beside LTspice: quick answers and practice here, detailed simulation there.

Open `app/index.html` in a browser. There is no build step and no dependencies.

## What it does

**Breadboard.** A half-size breadboard (30 columns, two rail pairs). The top ribbon has one button per kind of part the course uses: resistor, capacitor, inductor, potentiometer, switch, DC supply, AC source, diode, LED and op-amp. Picking one opens a row underneath with a one-line explanation, how to put it in, a few plain choices and common values. Two-lead parts go between two holes; the pot and DIP-8 op-amps drop in with one click using their real pinouts. The op-amps are the LM1458 used in class (dual, ±12 V), the LM741 and the single-supply LM358.

The circuit is solved with modified nodal analysis (Newton–Raphson for diodes, LEDs and op-amps):

- DC: every node voltage, and each part's voltage, current and power.
- AC: rms phasors (magnitude and angle) at any frequency.
- Checks: resistor wattage, LED current, op-amp supply and clipping, plus wiring notes for shorted parts and leads that connect to nothing.
- "Copy for LTspice" copies the board as a SPICE netlist.
- "Import LTspice" goes the other way: open a schematic (.asc) or netlist (.net, .cir), or paste the netlist from LTspice, and the parts are laid out on the breadboard. Ground and the supplies go on the rails and each other node gets its own column. Resistors, capacitors, inductors, diodes, LEDs, DC and sine sources and op-amps (as LM1458s, with ±12 V supplies added for the 3-pin symbol) come across; anything else is listed as skipped.

**Multimeter.** A 6000-count true-RMS handheld laid out like the Fluke 87V used on the bench. Turn the dial (V~, V⎓, mV, Ω, diode, mA/A, µA), plug the red lead into the VΩ, mA/µA or A jack, and click "Red" and "Black" to put the probe tips in holes on the board. It reads what a real meter would:

- Volts with a 10 MΩ input across the probes. V~ is AC-coupled true rms, so it reads 0 on a DC circuit.
- Ω, continuity (yellow button, beeps below 25 Ω), diode test (about 1 mA, OL when reversed) and capacitance (yellow button on the diode position) are measured with the supplies switched off, so a resistor reads correctly in circuit only when nothing else is in parallel with it.
- Current only flows through the meter when it is in series (break the circuit and bridge the gap with the probes). The shunts have the real burden (1.8 Ω on mA, 100 Ω on µA), and more than 440 mA through the mA jack blows its fuse. Leaving the red lead in a current jack with the dial on volts shows LEAd.
- RANGE (hold to return to auto), HOLD, MIN MAX (hold to stop), REL Δ and Hz work as on the meter.

**Sample circuits.** Eleven worked examples in course order: an LED, divider and RC filter; a series circuit and KVL (quiz question 4); a series-parallel circuit (quiz question 5); a loaded divider; two sources with superposition; a Wheatstone bridge; an RC high-pass filter; series RLC resonance; non-inverting and inverting op-amp amplifiers; and the op-amp adder from the midterm practical (two LM1458s: buffers, a summing amplifier and an inverter on ±12 V). Each one explains what the circuit shows, what the readings should say, and what to change next. A test checks every sample against the numbers in its write-up.

**Calculators.** Each shows its answer and the worked steps, in the form used on the midterm crib sheet: Ohm's law and power, resistor color code, series and parallel, voltage divider and loading, RC and RL time constant, sine wave (Vp, Vpp, Vrms, f, T, ω), phasor converter (rectangular ↔ polar with the quadrant fix), and reactance and impedance.

## Layout

- `app/index.html` – the user interface.
- `app/engine.js` – value handling, color codes, the parts list, the circuit solver and the sample circuits. It has no DOM dependencies.
- `tests/engine.test.js` – solver and formatting tests; `tests/devices.test.js` – device models, sample circuits and a random-circuit convergence check; `tests/import.test.js` – LTspice import; `tests/meter.test.js` – multimeter readings (`npm test`, Node 18 or later).
