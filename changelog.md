# ik-three changelog

## 2.0.0 (master)

- Restructured internal variables like `targetPositions` into their respective classes, instead of being in the base class.
- Removed `setIterations` and `setSquaredDistanceThreshold`.
- Added `setConfiguration`. All available parameters can be set using this function.
- Renamed `sqThreshold` to `thresholdTargetSq`.
- Added `thresholdCosAngle` to control whether a change of angle is enough to consider it as a movement.
- Added `thresholdIterSqDist` to control whether a change of position is enough to consider it as a movement.
- Improved early-exits.

FABRIK:
- Constrained chains now reach their target (if possible) instead of locking.

## 1.0.0