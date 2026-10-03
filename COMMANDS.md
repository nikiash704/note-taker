# Figure commands

_Generated from the code by `npm run docs`. 100 commands._

A line starting with `/` is a figure or a maths block. Details go on `+` lines below it (Shift+Enter starts one), or on the same line after `;` — both mean the same.

**Compute switch.** These commands can work out answers, which are only ever shown as suggestions (Tab accepts): /feasible, /rowops, /det, /inverse, /eigen, /system, /parallel, /truthtable, /cayley, /perm, /dist, /euclid.

## Contents

- [Graphs of functions](#graphs-of-functions)
- [Regions](#regions)
- [3D and multivariable](#3d-and-multivariable)
- [Linear algebra](#linear-algebra)
- [Differential equations](#differential-equations)
- [Geometry](#geometry)
- [Logic, sets and discrete maths](#logic-sets-and-discrete-maths)
- [Abstract algebra](#abstract-algebra)
- [Probability and statistics](#probability-and-statistics)
- [Complex analysis](#complex-analysis)
- [Topology, number theory, numerics](#topology-number-theory-numerics)
- [Blocks](#blocks)

## Graphs of functions

### /plot

Graphs of y = f(x). Extra lines: tangent at a, secant a to b, shade a..b, mark (x,y), hole (x,y), asymptote x=c, y -2..2, riemann n=4 left.

```
/plot x^2, 2x+1 from -3 to 3
  + tangent at 1
  + shade 0..2
  + mark (2, 4)
```

Also: /graph, /fn, /func, /function, /curve, /draw

### /area

Shaded area under a curve, or between two curves, from a to b.

```
/area x, x^2 from 0 to 1
```

Also: /shade, /integral

### /tangent

A curve with its tangent line at a point.

```
/tangent x^2 at 1
```

Also: /tangents

### /secant

A curve with the secant line through two of its points.

```
/secant x^2 from 1 to 2
```

### /riemann

Riemann sum rectangles: left, right, mid, trap, upper or lower; n rectangles.

```
/riemann x^2 from 0 to 2 n=4 left
```

Also: /rsum, /riemannsum

### /piecewise

A function defined in pieces; open and closed endpoints are drawn for you. Use “otherwise” for the rest.

```
/piecewise x^2 if x < 1
  + 2 - x if x >= 1
```

Also: /pw

### /taylor

A function with its Taylor polynomials around a point.

```
/taylor sin x at 0 order 1, 3, 5
```

Also: /maclaurin

### /parametric

A curve (x(t), y(t)) with arrows showing its direction. Several curves: one per line.

```
/parametric cos t, sin 2t
  + t from 0 to 2pi
```

Also: /param

### /polar

Polar curves r = f(θ) on a polar grid (write θ, theta or t).

```
/polar r = 1 + cos θ
  + r = 1
```

Also: /polarcurve

### /implicit

Curves given by an equation in x and y. Optional: x -3..3, y -2..2.

```
/implicit x^2 + y^2 = 4
  + y = x^2 - 1
  + x -3..3
```

### /conic

Ellipse (a, b), hyperbola (a, b, asymptotes) or parabola (p, focus, directrix); options foci, center (h,k), vertical. Or give an equation.

```
/conic ellipse a=3 b=2
  + foci
```

Also: /ellipse, /hyperbola, /parabola

### /sequence

The terms aₙ as dots. With eps= (and limit=), the ε-band and the N after which every term stays inside it.

```
/sequence (-1)^n / n for n from 1 to 30
  + eps=0.1 limit=0
```

Also: /seq

### /series

Partial sums Sₙ of a series as dots, with an optional limit line.

```
/series 1/n^2 for n from 1 to 30
  + limit=pi^2/6
```

Also: /partialsums

### /epsdelta

The ε-δ picture of a limit: the ε-band around L and a δ that works.

```
/epsdelta x^2 at 1
  + eps=0.5
```

Also: /epsilon

### /unitcircle

The unit circle. With an angle: the point, cos θ and sin θ (and tan with “tan”). Alone: the standard angles; add “coords” or “degrees”.

```
/unitcircle 2pi/3
  + tan
```

Also: /unit, /trig

### /signchart

Sign table of a function: one row per factor and one for f, with zeros (0) and undefined points (‖).

```
/signchart (x - 1)(x + 2)^2 / (x - 3)
```

Also: /signs, /sign

### /axes

A blank coordinate grid. Optional ranges (x -2..4 y -1..3) and points A(1,2).

```
/axes -3..3
```

Also: /axis, /grid, /coords, /coordinates, /points, /point

### /interval

Intervals on a number line. Unions with U, and inequalities like 0 <= x < 1.

```
/interval [0,1)
```

Also: /numberline, /number-line, /nl, /range, /ineq

## Regions

### /region

Shade where all the inequalities hold (dashed edge = strict). Use z for complex numbers: |z - 1| < 2. Optional view: x -2..2.

```
/region 0 <= x <= 1
  + x^2 <= y <= x
```

Also: /inequality, /inequalities

### /polarregion

A region described with r and θ (theta), for polar double integrals.

```
/polarregion 1 <= r <= 2
  + 0 <= θ <= pi/2
```

Also: /pregion

### /feasible

The feasible region of a linear program, its corner points and the direction of the objective. With Compute on, the optimum is suggested.

```
/feasible x + y <= 4, x <= 3, x, y >= 0
  + max 3x + 2y
```

Also: /lp, /linprog

### /ball

An open (dashed edge) or closed disk around a point, with its radius.

```
/ball (1, 1) r=2 open
```

Also: /disk, /disc, /nbhd, /neighborhood, /neighbourhood

## 3D and multivariable

### /axes3

Axes in space with labelled points; dashed lines show how to reach each point.

```
/axes3 P(1, 2, 3)
  + Q(2, -1, 1)
```

Also: /axes3d, /3d, /space

### /vec3

Vectors in space from the origin. Options: cross (u × v), sum (u + v and the parallelogram).

```
/vec3 u=(2, 0, 0) v=(0, 2, 1)
  + cross
  + sum
```

Also: /vec3d, /vector3

### /surface

The graph z = f(x, y), shaded so nearer parts hide farther ones. Optional ranges for x and y.

```
/surface z = x^2 - y^2
  + x -2..2
  + y -2..2
```

Also: /surf, /plot3, /plot3d

### /contour

Level curves f(x, y) = c, coloured from low (blue) to high (red). Choose levels or let the app pick.

```
/contour x^2 + 2y^2
  + levels 1, 2, 4, 8
```

Also: /level, /levels, /levelcurves

### /field

A 2D vector field F = (P, Q) as arrows; longer arrows are stronger.

```
/field (-y, x)
  + x -2..2
```

Also: /vectorfield, /vf

### /gradient

Level curves of f with its gradient arrows (they cross the level curves at right angles).

```
/gradient x^2 + 2y^2
```

Also: /grad

### /plane

A plane in space: an equation (intercepts are shown when it cuts all three axes), or “through (1,0,0) normal (1,1,1)”.

```
/plane 2x + 3y + 6z = 6
```

### /line3

A line in space: point + t·direction, or “through (0,0,0) and (1,2,3)”.

```
/line3 (1, 0, 0) + t(1, 2, 2)
```

Also: /line3d

### /solid

cube, box (a b c), prism (n), pyramid (n), tetrahedron, cylinder (r h), cone (r h), sphere (r), paraboloid. Hidden edges dashed.

```
/solid cylinder r=1 h=2
```

Also: /cube, /cuboid, /box, /prism, /pyramid, /tetrahedron, /cylinder, /cone, /sphere, /paraboloid

### /curve3

A space curve (x(t), y(t), z(t)) with direction arrows.

```
/curve3 cos t, sin t, t/4
  + t from 0 to 4pi
```

Also: /helix, /spacecurve

### /loop

A closed curve C around a region D with its orientation (Green’s theorem). Shapes: circle, ellipse, square, triangle, blob; options cw, normals, tangents.

```
/loop blob ccw
  + normals
```

Also: /green, /stokes, /closedcurve

## Linear algebra

### /vec

Arrows on a grid: /vec u=(2,3) v=(-1,2), or /vec (1,1) -> (3,2).

```
/vec (2,3)
```

Also: /vector, /arrow, /arrows

### /matrix

A matrix from quick input: rows on “+” lines (or separated by ;), entries by spaces or commas. [ ] gives square brackets.

```
/matrix A = 1 2 3
  + 4 5 6
  + 7 8 9
```

Also: /mat

### /augmented

An augmented matrix with a bar. Without “|”, the bar goes before the last column.

```
/augmented 1 2 | 5
  + 3 4 | 6
```

Also: /aug

### /rowops

Row reduction: write the matrix, then one row operation per line (R2 - 3R1, 1/2 R1, R1 <-> R2). Each result is worked out and shown. With Compute on, the next step is suggested.

```
/rowops 1 2 | 5
  + 3 4 | 6
  + R2 - 3R1
  + -1/2 R2
```

Also: /rref, /rowreduce, /elim, /ero

### /det

A determinant |A|. With Compute on, its value is suggested (“= 2”).

```
/det 2 1
  + 4 3
```

Also: /determinant

### /inverse

A matrix inverse A⁻¹ (with Compute on, suggested as “= [...]”). Given a function instead, draws f and its inverse: /inverse e^x.

```
/inverse 2 1
  + 5 3
```

Also: /inv

### /eigen

A matrix and its eigenvalues/eigenvectors. With Compute on, “λ = …” and “v = …” are suggested; for 2×2, written eigenvectors are also drawn.

```
/eigen 2 1
  + 1 2
```

Also: /eig, /eigenvalues, /eigenvectors

### /system

A system of equations, aligned with a brace. With Compute on, the solution is suggested (“⇒ x = 1, …”).

```
/system x + y + z = 6
  + 2x - y = 0
  + y - z = -1
```

Also: /sys, /equations

### /vectors

Column vectors in maths text: every (a, b, c) becomes a column. Good for linear combinations and spans.

```
/vectors 2(1, 0, 3) - (2, 1, 1) = (0, -1, 5)
```

Also: /colvec, /columns

### /transform

What a 2×2 matrix does to the plane: the grid, the unit square and the images of e₁ and e₂.

```
/transform 1 1
  + 0 1
```

Also: /linmap, /lintrans

### /span

The span of vectors: a line (one vector, or dependent ones) or the whole plane; in 3D a line or a plane.

```
/span (1, 2)
```

### /projection

The projection of u onto v, with the perpendicular part dashed.

```
/projection (3, 1) onto (1, 2)
```

Also: /proj

### /lines

Linear equations in x and y drawn as lines (a 2×2 system); where they meet is marked.

```
/lines x + y = 3
  + x - 2y = 0
```

Also: /line

### /parallelogram

The parallelogram spanned by two vectors (its area is |det|). Given vertex names instead (ABCD), draws the shape.

```
/parallelogram (3, 0) (1, 2)
```

## Differential equations

### /slopefield

Direction field of y′ = f(x, y), with solution curves through the points you give.

```
/slopefield y' = y - x
  + through (0, 1)
  + through (0, 0.5)
```

Also: /slope, /dirfield, /directionfield, /ode

### /phase

Phase portrait of a 2D system (or of the matrix A in x′ = Ax): arrows and trajectories. Add “through (1,0)” for your own starting points.

```
/phase x' = y, y' = -x - 0.3y
```

Also: /portrait, /phaseportrait

### /phaseline

Phase line of y′ = f(y): equilibria (filled = stable, hollow = unstable) and arrows, with some solution curves beside it.

```
/phaseline y' = y(1 - y)
```

Also: /pline

### /euler

Euler’s method: the steps (dots) against the true solution (dashed).

```
/euler y' = y from (0, 1)
  + h=0.5 n=4
```

### /fourier

Fourier partial sums Sₙ of a 2π-periodic function: square, sawtooth, triangle, or any f(x) given on (−π, π).

```
/fourier square
  + n=1, 3, 9
```

Also: /fseries

### /spring

Mass–spring sketch for mx″ + cx′ + kx = F(t); options damping, force.

```
/spring damping
  + force
```

Also: /mass

## Geometry

### /triangle

Right, isosceles, equilateral or obtuse; sides (a=3, AB=5), angles (A=30°); altitude/median/bisector from X, centroid, orthocenter, circumcircle, incircle.

```
/triangle ABC
  + altitude from A
  + circumcircle
  + centroid
```

Also: /tri, /triang

### /circle

A circle with named points on it. Lines: chord AB, diameter CD, radius OA, tangent at A, arc AB, sector AB (or sector 30..120), angle ACB, point A at 45.

```
/circle O r=2
  + chord AB
  + tangent at A
  + angle ACB
```

### /polygon

Regular n-gons (/polygon 6), named quadrilaterals (square, rectangle, rhombus, parallelogram, trapezoid, kite) with equal-side ticks and right angles, or your own points. Options: diagonals, symmetries.

```
/polygon square ABCD
  + diagonals
  + symmetries
```

Also: /ngon, /square, /rectangle, /rhombus, /trapezoid, /trapezium, /kite, /pentagon, /hexagon, /octagon, /quadrilateral

### /angle

An angle between two rays with its measure (90 gets a square). Add “bisector” to halve it.

```
/angle ABC = 40°
```

### /parallel

Two parallel lines cut by a transversal, angles numbered 1–8. Highlight corresponding, alternate, co-interior or vertical pairs. With Compute on, all eight angles are suggested.

```
/parallel angle=60
  + alternate
```

Also: /transversal

### /construct

Ruler-and-compass style: points A=(x,y); segment AB, line AB, ray AB, triangle/polygon ABC, circle A through B, circle A r=2, circle ABC, midpoint M of AB, perp from C to AB (as H), perp bisector AB, parallel through C to AB, P = AB ∩ CD, angle ABC.

```
/construct A=(0,0) B=(4,0) C=(1,3)
  + triangle ABC
  + perp from C to AB as H
  + midpoint M of BC
  + circle ABC
```

Also: /geo, /geometry

### /poincare

The Poincaré disk: points inside the unit disk and hyperbolic lines (arcs meeting the boundary at right angles). “segment AB”, “line AB” (to the boundary), “triangle”.

```
/poincare A(0.2, 0.5) B(-0.6, 0.1) C(0.3, -0.5)
  + triangle
  + line AB
```

Also: /hyperbolic

## Logic, sets and discrete maths

### /truthtable

A truth table (T first). Result columns stay empty for you to fill with “= T F T T” lines; with Compute on they are suggested.

```
/truthtable p -> q, ~q -> ~p
```

Also: /truth, /tt, /logic

### /venn

Venn diagram of 2 or 3 sets with an expression shaded: ∪ (or u, cup), ∩ (or n, cap), ' for complement, − for difference, Δ.

```
/venn A ∩ B'
```

Also: /sets

### /mapping

An arrow diagram of a function or relation between two sets (to check injective/surjective).

```
/mapping {1, 2, 3} -> {a, b}
  + 1 -> a, 2 -> a, 3 -> b
```

Also: /map, /maps

### /network

A graph (vertices and edges): A-B, A->B (directed), A-B:3 (weight). Or a named graph: K5, C6, P4, W6, S5, K3,3, Petersen, cube.

```
/network A-B:4, B-C:2, C-A:5
  + C-D:1
```

Also: /net, /digraph

### /tree

A rooted tree from nested brackets: a(b, c(d)). Edge labels with “:”, e.g. a(b:1, c:2).

```
/tree 8(3(1, 6(4, 7)), 10(14(13)))
```

Also: /rooted

### /hasse

Hasse diagram: divisors n, subsets {a,b,c}, subgroups Z12, or your own order: a < b, a < c, b < d.

```
/hasse divisors 12
```

Also: /poset, /lattice

### /relation

A relation on a set as a directed graph (loops for x R x). Pairs can also be written (1,2), (2,3).

```
/relation {1, 2, 3}: 1->2, 2->3, 1->3, 1->1
```

Also: /rel

### /automaton

A finite automaton: transitions “q0 -a-> q1” (chains allowed), “accept q2”, “start q0” (otherwise the first state).

```
/automaton q0 -a-> q1 -b-> q2
  + q1 -a-> q1
  + q2 -a,b-> q0
  + accept q2
```

Also: /fsm, /dfa, /nfa, /machine

### /diagram

Boxes and arrows. Label arrows with -f->, separate chains with ;

```
/diagram A -> B -> C
```

Also: /diag, /flow, /chain, /cd, /boxes

## Abstract algebra

### /cayley

A group table for Zn, U(n), Dn, S3, V4, Q8 (or Zn * for multiplication mod n). Fill rows with “+” lines; with Compute on the rows are suggested.

```
/cayley Z4
```

Also: /grouptable, /group

### /perm

A permutation in two-line notation with an arrow diagram. Cycles multiply right to left. With Compute on, the disjoint cycles, order and sign are suggested.

```
/perm (1 2 3)(3 4)
```

Also: /permutation, /cycle

## Probability and statistics

### /dist

A distribution: normal μ σ, t df, chisq k, exponential λ, uniform a b, binomial n p, poisson λ, geometric p. “shade a..b” or “shade < 1.96” colours a probability; with Compute on, its value is suggested.

```
/dist normal 0 1
  + shade -1..1
```

Also: /normal, /bell, /density, /pdf, /distribution, /tdist, /chisq, /exponential, /uniform, /binomial, /poisson, /geometric, /pmf

### /cdf

The cumulative distribution function F(x) = P(X ≤ x): a step function for discrete distributions.

```
/cdf binomial n=5 p=0.5
```

### /hist

A histogram of the numbers you give (bins=k to choose the number of bars).

```
/hist 2 3 3 4 5 5 5 6 7 7 8 9 12
  + bins=5
```

Also: /histogram

### /boxplot

Box plots (min, quartiles, median, max; points beyond 1.5 IQR shown separately). One data set per line, optionally named “A: …”.

```
/boxplot A: 2 3 5 6 7 8 9 12
  + B: 4 5 5 6 6 7 15
```

Also: /boxwhisker

### /scatter

A scatter plot of points (x, y), or “x: 1 2 3” and “y: 2 4 5” lines. “fit” adds the least-squares line, “residuals” the vertical gaps.

```
/scatter (1, 2) (2, 2.8) (3, 4.1) (4, 4.4) (5, 6.2)
  + fit
```

Also: /regression

### /probtree

A probability tree drawn left to right: each branch is “outcome probability”, followed by (its sub-branches).

```
/probtree H 1/2 (H 1/2, T 1/2)
  + T 1/2 (H 1/2, T 1/2)
```

Also: /ptree

## Complex analysis

### /complex

Complex numbers on the Argand plane as arrows. Options: modulus (circle and |z|), arg (angle θ), conj (the conjugate).

```
/complex z = 1 + i, w = 2e^(i pi/3)
  + modulus
  + arg
```

Also: /argand

### /roots

The n solutions of zⁿ = w: equally spaced on a circle, forming a regular polygon.

```
/roots z^6 = 1
```

Also: /unity

### /contourpath

An integration contour with its orientation: circle |z - a| = r, semicircle R=…, keyhole, rectangle a..b, c..d. “poles …” marks singularities with ×. Add “cw” for clockwise.

```
/contourpath semicircle R=3
  + poles i, 2i, -1
```

Also: /cpath, /contourintegral

### /conformal

A grid in the z-plane (left) and its image under w = f(z) (right). Domain: a rectangle “x a..b y c..d” (default the unit square around 0) or “disk”.

```
/conformal z^2
  + x 0..1.5 y 0..1.5
```

## Topology, number theory, numerics

### /glue

A gluing (identification) diagram from a word: a b a^-1 b^-1 (torus). Named: torus, klein, rp2, sphere, mobius. Edges with the same letter get the same number of arrowheads.

```
/glue a b a^-1 b^-1
```

Also: /identification, /torus, /klein, /mobius, /rp2

### /euclid

Euclid’s algorithm for gcd(a, b): write each step “252 = 1·198 + 54” on a “+” line (or let Compute suggest them, with the gcd and Bézout’s identity).

```
/euclid 252 198
```

Also: /gcd, /euclidean

### /clock

Arithmetic mod n on a clock. Options: mark a, b · add a b (start at a, step b) · multiples k (joins 0, k, 2k, … — a cyclic subgroup).

```
/clock 12
  + add 7 8
  + multiples 3
```

Also: /modular

### /newton

Newton’s method: tangent lines from xₖ down to the x-axis give xₖ₊₁.

```
/newton x^2 - 2 from 3 steps 3
```

Also: /newtons

### /cobweb

Cobweb diagram for the iteration xₙ₊₁ = g(xₙ): the curve, the line y = x and the staircase/spiral between them.

```
/cobweb cos x from 0.2 steps 8
```

Also: /fixedpoint, /iteration

### /bisection

The bisection method: the function and, underneath, the interval halving at each step.

```
/bisection x^3 - x - 2 on [1, 2] steps 4
```

Also: /bisect

### /interpolate

The polynomial of lowest degree through the given points (Lagrange interpolation).

```
/interpolate (0, 1) (1, 3) (2, 2) (3, 5)
```

Also: /interp, /lagrange

## Blocks

### /table

A table: one row per line, cells separated by “|” (or commas). The first row is the header. Maths in cells is typeset; words stay words.

```
/table x | 0 | π/2 | π
  + sin x | 0 | 1 | 0
  + cos x | 1 | 0 | −1
```

Also: /tab

### /cases

A definition by cases with a brace. Each case: “formula if condition”, “formula, condition” or “formula otherwise”.

```
/cases |x| = x if x >= 0
  + -x if x < 0
```

### /align

A chain of equalities lined up on “=”. Lines starting with =, <, ≤ … continue the chain; [a reason] adds a note on the right.

```
/align (a + b)^2 = (a + b)(a + b)
  + = a^2 + ab + ba + b^2
  + = a^2 + 2ab + b^2 [since ab = ba]
```

Also: /derivation, /steps

### /def

A boxed definition. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/def A group is a set with an associative operation, an identity and inverses.
```

Also: /definition

### /thm

A boxed theorem. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/thm [Bolzano] Every bounded sequence in $\mathbb{R}$
  + has a convergent subsequence.
```

Also: /theorem

### /lemma

A boxed lemma. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/lemma Text with $math$ inside.
```

### /prop

A boxed proposition. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/prop Text with $math$ inside.
```

Also: /proposition

### /cor

A boxed corollary. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/cor Text with $math$ inside.
```

Also: /corollary

### /proof

A boxed proof. Optional name in [brackets]; “+” lines continue it; it ends with ∎. $math$ works inside.

```
/proof Suppose √2 = p/q in lowest terms.
  + Then $p^2 = 2q^2$, so p is even…
  + …so q is even too, a contradiction.
```

Also: /pf

### /ex

A boxed example. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/ex Text with $math$ inside.
```

Also: /example

### /note

A boxed note. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/note Text with $math$ inside.
```

### /rem

A boxed remark. Optional name in [brackets]; “+” lines continue it. $math$ works inside.

```
/rem Text with $math$ inside.
```

Also: /remark

