/** [WASM] */

const MAX_SIGNIFICANT_DIGITS: f64 = 17;
const EXP_LIMIT: f64 = 9e15;
const LAYER_DOWN: f64 = 15.954589770191003;
const FIRST_NEG_LAYER: f64 = 1 / EXP_LIMIT;
const CONSTANT_COUNT: i32 = 201;
const DECIMAL_TRANSFER_CAPACITY: i32 = 256;
const DECIMAL_COMPONENT_COUNT: i32 = 3;

const signs = new Array<i32>();
const layers = new Array<i32>();
const magnitudes = new Array<f64>();
const constantSigns = new Array<i32>();
const constantLayers = new Array<i32>();
const constantMagnitudes = new Array<f64>();
let nextHandle: i32 = CONSTANT_COUNT;
const decimalTransferBuffer = new StaticArray<f64>(DECIMAL_TRANSFER_CAPACITY * DECIMAL_COMPONENT_COUNT);

for (let value: i32 = 0; value < CONSTANT_COUNT; value++) {
    constantSigns.push(value === 0 ? 0 : 1);
    constantLayers.push(0);
    constantMagnitudes.push(value);
}

export function resetDecimalCache(): void {
    nextHandle = CONSTANT_COUNT;
}

export function nextDecimalHandle(): i32 {
    return nextHandle;
}

export function releaseDecimalsFrom(handle: i32): void {
    assertMutable(handle);
    nextHandle = handle;
}

export function decimalTransferAddress(): usize {
    return changetype<usize>(decimalTransferBuffer);
}

export function decimalTransferCapacity(): i32 {
    return DECIMAL_TRANSFER_CAPACITY;
}

export function createDecimalsFromTransfer(count: i32): i32 {
    assertTransferCount(count);
    const firstHandle = nextHandle;
    for (let index: i32 = 0; index < count; index++) {
        const componentIndex = index * DECIMAL_COMPONENT_COUNT;
        const handle = allocateDecimal();
        normalizeInto(
            handle,
            decimalTransferBuffer[componentIndex],
            decimalTransferBuffer[componentIndex + 1],
            decimalTransferBuffer[componentIndex + 2],
        );
    }
    return firstHandle;
}

export function writeDecimalsToTransfer(firstHandle: i32, count: i32): void {
    assertTransferCount(count);
    for (let index: i32 = 0; index < count; index++) {
        const componentIndex = index * DECIMAL_COMPONENT_COUNT;
        const handle = firstHandle + index;
        decimalTransferBuffer[componentIndex] = readSign(handle);
        decimalTransferBuffer[componentIndex + 1] = readLayer(handle);
        decimalTransferBuffer[componentIndex + 2] = readMagnitude(handle);
    }
}

function assertTransferCount(count: i32): void {
    if (count < 0 || count > DECIMAL_TRANSFER_CAPACITY) {
        throw new Error("Decimal transfer count is outside the transfer buffer capacity");
    }
}

export function createZero(): i32 {
    return createDecimal(0, 0, 0);
}

export function createDecimal(sign: f64, layer: f64, magnitude: f64): i32 {
    const result = allocateDecimal();
    normalizeInto(result, sign, layer, magnitude);
    return result;
}

export function createDecimalFromNumber(value: f64): i32 {
    const result = allocateDecimal();
    writeNumber(result, value);
    return result;
}

export function add(left: i32, right: i32): i32 {
    const result = allocateDecimal();
    addInto(result, left, right);
    return result;
}

export function addUS(left: i32, right: i32): i32 {
    assertMutable(left);
    addInto(left, left, right);
    return left;
}

export function mul(left: i32, right: i32): i32 {
    const result = allocateDecimal();
    multiplyInto(result, left, right);
    return result;
}

export function mulUS(left: i32, right: i32): i32 {
    assertMutable(left);
    multiplyInto(left, left, right);
    return left;
}

export function addInto(result: i32, left: i32, right: i32): void {
    addComponentsInto(
        result,
        readSign(left), readLayer(left), readMagnitude(left),
        readSign(right), readLayer(right), readMagnitude(right),
    );
}

function addComponentsInto(
    result: i32,
    leftSign: f64,
    leftLayer: f64,
    leftMagnitude: f64,
    rightSign: f64,
    rightLayer: f64,
    rightMagnitude: f64,
): void {
    if (
        isNaN(leftSign) || isNaN(leftLayer) || isNaN(leftMagnitude) ||
        isNaN(rightSign) || isNaN(rightLayer) || isNaN(rightMagnitude)
    ) {
        writeNaN(result);
        return;
    }

    const leftInfinite = leftLayer === Infinity || leftMagnitude === Infinity;
    const rightInfinite = rightLayer === Infinity || rightMagnitude === Infinity;
    if (leftInfinite || rightInfinite) {
        if (leftInfinite && rightInfinite && leftSign === -rightSign) {
            writeNaN(result);
            return;
        }
        if (leftInfinite) {
            writeInfinity(result, leftSign);
            return;
        }
        writeInfinity(result, rightSign);
        return;
    }

    if (leftSign === 0) {
        writeDecimal(result, rightSign, rightLayer, rightMagnitude);
        return;
    }
    if (rightSign === 0) {
        writeDecimal(result, leftSign, leftLayer, leftMagnitude);
        return;
    }
    if (leftSign === -rightSign && leftLayer === rightLayer && leftMagnitude === rightMagnitude) {
        writeDecimal(result, 0, 0, 0);
        return;
    }

    let aSign = leftSign;
    let aLayer = leftLayer;
    let aMagnitude = leftMagnitude;
    let bSign = rightSign;
    let bLayer = rightLayer;
    let bMagnitude = rightMagnitude;
    if (compareAbsolute(leftLayer, leftMagnitude, rightLayer, rightMagnitude) <= 0) {
        aSign = rightSign;
        aLayer = rightLayer;
        aMagnitude = rightMagnitude;
        bSign = leftSign;
        bLayer = leftLayer;
        bMagnitude = leftMagnitude;
    }

    if (aLayer >= 2 || bLayer >= 2) {
        writeDecimal(result, aSign, aLayer, aMagnitude);
        return;
    }
    if (aLayer === 0 && bLayer === 0) {
        writeNumber(result, aSign * aMagnitude + bSign * bMagnitude);
        return;
    }

    const signedLayerA = aLayer * signOf(aMagnitude);
    const signedLayerB = bLayer * signOf(bMagnitude);
    if (signedLayerA - signedLayerB >= 2) {
        writeDecimal(result, aSign, aLayer, aMagnitude);
        return;
    }

    let logarithm: f64;
    let exponent: f64;
    if (signedLayerA === 0 && signedLayerB === -1) {
        logarithm = Math.log10(aMagnitude);
        if (Math.abs(bMagnitude - logarithm) > MAX_SIGNIFICANT_DIGITS) {
            writeDecimal(result, aSign, aLayer, aMagnitude);
            return;
        }
        exponent = bMagnitude;
    } else if (signedLayerA === 1 && signedLayerB === 0) {
        exponent = Math.log10(bMagnitude);
        if (Math.abs(aMagnitude - exponent) > MAX_SIGNIFICANT_DIGITS) {
            writeDecimal(result, aSign, aLayer, aMagnitude);
            return;
        }
        logarithm = aMagnitude;
    } else {
        if (Math.abs(aMagnitude - bMagnitude) > MAX_SIGNIFICANT_DIGITS) {
            writeDecimal(result, aSign, aLayer, aMagnitude);
            return;
        }
        logarithm = aMagnitude;
        exponent = bMagnitude;
    }

    const magnitudeDifference = Math.pow(10, logarithm - exponent);
    const mantissa = bSign + aSign * magnitudeDifference;
    normalizeInto(result, signOf(mantissa), 1, exponent + Math.log10(Math.abs(mantissa)));
}

export function multiplyInto(result: i32, left: i32, right: i32): void {
    multiplyComponentsInto(
        result,
        readSign(left), readLayer(left), readMagnitude(left),
        readSign(right), readLayer(right), readMagnitude(right),
    );
}

function multiplyComponentsInto(
    result: i32,
    leftSign: f64,
    leftLayer: f64,
    leftMagnitude: f64,
    rightSign: f64,
    rightLayer: f64,
    rightMagnitude: f64,
): void {
    if (
        isNaN(leftSign) || isNaN(leftLayer) || isNaN(leftMagnitude) ||
        isNaN(rightSign) || isNaN(rightLayer) || isNaN(rightMagnitude)
    ) {
        writeNaN(result);
        return;
    }

    const leftInfinite = leftLayer === Infinity || leftMagnitude === Infinity;
    const rightInfinite = rightLayer === Infinity || rightMagnitude === Infinity;
    if ((leftInfinite && rightSign === 0) || (rightInfinite && leftSign === 0)) {
        writeNaN(result);
        return;
    }
    if (leftInfinite || rightInfinite) {
        writeInfinity(result, leftSign * rightSign);
        return;
    }

    if (leftSign === 0 || rightSign === 0) {
        writeDecimal(result, 0, 0, 0);
        return;
    }
    const resultSign = leftSign * rightSign;
    if (leftLayer === rightLayer && leftMagnitude === -rightMagnitude) {
        writeDecimal(result, resultSign, 0, 1);
        return;
    }

    let aLayer = leftLayer;
    let aMagnitude = leftMagnitude;
    let bLayer = rightLayer;
    let bMagnitude = rightMagnitude;
    if (leftLayer < rightLayer || (leftLayer === rightLayer && Math.abs(leftMagnitude) <= Math.abs(rightMagnitude))) {
        aLayer = rightLayer;
        aMagnitude = rightMagnitude;
        bLayer = leftLayer;
        bMagnitude = leftMagnitude;
    }

    if (aLayer === 0 && bLayer === 0) {
        writeNumber(result, resultSign * aMagnitude * bMagnitude);
        return;
    }
    if (aLayer >= 3 || aLayer - bLayer >= 2) {
        normalizeInto(result, resultSign, aLayer, aMagnitude);
        return;
    }
    if (aLayer === 1 && bLayer === 0) {
        normalizeInto(result, resultSign, 1, aMagnitude + Math.log10(bMagnitude));
        return;
    }
    if (aLayer === 1 && bLayer === 1) {
        normalizeInto(result, resultSign, 1, aMagnitude + bMagnitude);
        return;
    }

    addComponentsInto(result, signOf(aMagnitude), aLayer - 1, Math.abs(aMagnitude), signOf(bMagnitude), bLayer - 1, Math.abs(bMagnitude));
    normalizeInto(result, resultSign, readLayer(result) + 1, readSign(result) * readMagnitude(result));
}

export function normalizeInto(result: i32, sign: f64, layer: f64, magnitude: f64): void {
    if (sign === 0 || (magnitude === 0 && layer === 0) || (magnitude === -Infinity && layer > 0)) {
        writeDecimal(result, 0, 0, 0);
        return;
    }
    if (layer === 0 && magnitude < 0) {
        magnitude = -magnitude;
        sign = -sign;
    }
    if (magnitude === Infinity || layer === Infinity || magnitude === -Infinity || layer === -Infinity) {
        writeInfinity(result, sign);
        return;
    }
    if (layer === 0 && magnitude < FIRST_NEG_LAYER) {
        writeDecimal(result, sign, 1, Math.log10(magnitude));
        return;
    }

    let absoluteMagnitude = Math.abs(magnitude);
    let magnitudeSign = signOf(magnitude);
    if (absoluteMagnitude >= EXP_LIMIT) {
        writeDecimal(result, sign, layer + 1, magnitudeSign * Math.log10(absoluteMagnitude));
        return;
    }
    while (absoluteMagnitude < LAYER_DOWN && layer > 0) {
        layer -= 1;
        if (layer === 0) {
            magnitude = Math.pow(10, magnitude);
        } else {
            magnitude = magnitudeSign * Math.pow(10, absoluteMagnitude);
            absoluteMagnitude = Math.abs(magnitude);
            magnitudeSign = signOf(magnitude);
        }
    }
    if (layer === 0 && magnitude < 0) {
        magnitude = -magnitude;
        sign = -sign;
    } else if (layer === 0 && magnitude === 0) {
        sign = 0;
    }
    if (isNaN(sign) || isNaN(layer) || isNaN(magnitude)) {
        writeNaN(result);
        return;
    }
    writeDecimal(result, sign, layer, magnitude);
}

function compareAbsolute(leftLayer: f64, leftMagnitude: f64, rightLayer: f64, rightMagnitude: f64): i32 {
    const signedLeftLayer = leftMagnitude > 0 ? leftLayer : -leftLayer;
    const signedRightLayer = rightMagnitude > 0 ? rightLayer : -rightLayer;
    if (signedLeftLayer > signedRightLayer) return 1;
    if (signedLeftLayer < signedRightLayer) return -1;
    if (leftMagnitude > rightMagnitude) return 1;
    if (leftMagnitude < rightMagnitude) return -1;
    return 0;
}

function signOf(value: f64): f64 {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
}

export function allocateDecimal(): i32 {
    const handle = nextHandle++;
    const index = mutableIndex(handle);
    if (index === signs.length) {
        signs.push(0);
        layers.push(0);
        magnitudes.push(0);
    }
    return handle;
}

export function writeNumber(handle: i32, value: f64): i32 {
    normalizeInto(handle, signOf(value), 0, Math.abs(value));
    return handle;
}

export function writeDecimal(handle: i32, sign: f64, layer: f64, magnitude: f64): void {
    const index = mutableIndex(handle);
    signs[index] = <i32>sign;
    layers[index] = <i32>layer;
    magnitudes[index] = magnitude;
}

function mutableIndex(handle: i32): i32 {
    return handle - CONSTANT_COUNT;
}

function assertMutable(handle: i32): void {
    if (handle < CONSTANT_COUNT) throw new Error("Cannot mutate an immutable Decimal constant");
}

export function readSign(handle: i32): f64 {
    return handle < CONSTANT_COUNT ? constantSigns[handle] : signs[mutableIndex(handle)];
}

export function readLayer(handle: i32): f64 {
    return handle < CONSTANT_COUNT ? constantLayers[handle] : layers[mutableIndex(handle)];
}

export function readMagnitude(handle: i32): f64 {
    return handle < CONSTANT_COUNT ? constantMagnitudes[handle] : magnitudes[mutableIndex(handle)];
}

export function getSign(handle: i32): f64 {
    return readSign(handle);
}

export function getLayer(handle: i32): f64 {
    return readLayer(handle);
}

export function getMagnitude(handle: i32): f64 {
    return readMagnitude(handle);
}

function writeNaN(handle: i32): void {
    writeDecimal(handle, 0, 0, NaN);
}

function writeInfinity(handle: i32, sign: f64): void {
    writeDecimal(handle, signOf(sign), 0, Infinity);
}

export function copyInto(result: i32, value: i32): void {
    writeDecimal(result, readSign(value), readLayer(value), readMagnitude(value));
}

export function copy(value: i32): i32 {
    const result = allocateDecimal();
    copyInto(result, value);
    return result;
}

export function negInto(result: i32, value: i32): void {
    writeDecimal(result, -readSign(value), readLayer(value), readMagnitude(value));
}

export function neg(value: i32): i32 {
    const result = allocateDecimal();
    negInto(result, value);
    return result;
}

export function negUS(value: i32): i32 {
    assertMutable(value);
    negInto(value, value);
    return value;
}

export function absInto(result: i32, value: i32): void {
    writeDecimal(result, Math.abs(readSign(value)), readLayer(value), readMagnitude(value));
}

export function abs(value: i32): i32 {
    const result = allocateDecimal();
    absInto(result, value);
    return result;
}

export function subInto(result: i32, left: i32, right: i32): void {
    addComponentsInto(
        result,
        readSign(left), readLayer(left), readMagnitude(left),
        -readSign(right), readLayer(right), readMagnitude(right),
    );
}

export function sub(left: i32, right: i32): i32 {
    const result = allocateDecimal();
    subInto(result, left, right);
    return result;
}

export function subUS(left: i32, right: i32): i32 {
    assertMutable(left);
    subInto(left, left, right);
    return left;
}

export function reciprocalInto(result: i32, value: i32): void {
    const sign = readSign(value);
    const layer = readLayer(value);
    const magnitude = readMagnitude(value);

    if (isNaN(sign) || isNaN(layer) || isNaN(magnitude)) {
        writeNaN(result);
        return;
    }
    if (magnitude === 0) {
        writeNaN(result);
        return;
    }
    if (magnitude === Infinity || layer === Infinity) {
        writeDecimal(result, 0, 0, 0);
        return;
    }
    if (layer === 0) {
        normalizeInto(result, sign, 0, 1 / magnitude);
        return;
    }
    normalizeInto(result, sign, layer, -magnitude);
}

export function reciprocal(value: i32): i32 {
    const result = allocateDecimal();
    reciprocalInto(result, value);
    return result;
}

export function reciprocalUS(value: i32): i32 {
    assertMutable(value);
    reciprocalInto(value, value);
    return value;
}

export function divInto(result: i32, left: i32, right: i32): void {
    const rightSign = readSign(right);
    const rightLayer = readLayer(right);
    const rightMagnitude = readMagnitude(right);

    if (isNaN(rightSign) || isNaN(rightLayer) || isNaN(rightMagnitude)) {
        writeNaN(result);
        return;
    }
    if (rightMagnitude === 0) {
        writeNaN(result);
        return;
    }

    let reciprocalLayer = rightLayer;
    let reciprocalMagnitude = rightMagnitude;

    if (rightMagnitude === Infinity || rightLayer === Infinity) {
        multiplyComponentsInto(
            result,
            readSign(left), readLayer(left), readMagnitude(left),
            0, 0, 0,
        );
        return;
    }

    if (rightLayer === 0) {
        reciprocalLayer = 0;
        reciprocalMagnitude = 1 / rightMagnitude;
    } else {
        reciprocalMagnitude = -rightMagnitude;
    }

    multiplyComponentsInto(
        result,
        readSign(left), readLayer(left), readMagnitude(left),
        rightSign, reciprocalLayer, reciprocalMagnitude,
    );
}

export function div(left: i32, right: i32): i32 {
    const result = allocateDecimal();
    divInto(result, left, right);
    return result;
}

export function divUS(left: i32, right: i32): i32 {
    assertMutable(left);
    divInto(left, left, right);
    return left;
}

export function absLog10Into(result: i32, value: i32): void {
    const sign = readSign(value);
    const layer = readLayer(value);
    const magnitude = readMagnitude(value);

    if (sign === 0 || isNaN(sign) || isNaN(layer) || isNaN(magnitude)) {
        writeNaN(result);
        return;
    }
    if (layer > 0) {
        normalizeInto(result, signOf(magnitude), layer - 1, Math.abs(magnitude));
        return;
    }
    normalizeInto(result, 1, 0, Math.log10(magnitude));
}

export function absLog10(value: i32): i32 {
    const result = allocateDecimal();
    absLog10Into(result, value);
    return result;
}

export function log10Into(result: i32, value: i32): void {
    const sign = readSign(value);
    if (sign <= 0 || isNaN(sign)) {
        writeNaN(result);
        return;
    }
    absLog10Into(result, value);
}

export function log10(value: i32): i32 {
    const result = allocateDecimal();
    log10Into(result, value);
    return result;
}

export function pow10Into(result: i32, value: i32): void {
    const sign = readSign(value);
    let layer = readLayer(value);
    let magnitude = readMagnitude(value);

    if (isNaN(sign) || isNaN(layer) || isNaN(magnitude)) {
        writeNaN(result);
        return;
    }

    if (layer === Infinity && magnitude === Infinity) {
        if (sign > 0) {
            writeInfinity(result, 1);
        } else {
            writeDecimal(result, 0, 0, 0);
        }
        return;
    }

    if (layer === 0) {
        const nativeMagnitude = Math.pow(10, sign * magnitude);
        if (isFinite(nativeMagnitude) && Math.abs(nativeMagnitude) >= 0.1) {
            normalizeInto(result, 1, 0, nativeMagnitude);
            return;
        }

        if (sign === 0) {
            writeDecimal(result, 1, 0, 1);
            return;
        }

        layer = 1;
        magnitude = Math.log10(magnitude);
    }

    if (sign > 0 && magnitude >= 0) {
        normalizeInto(result, sign, layer + 1, magnitude);
        return;
    }
    if (sign < 0 && magnitude >= 0) {
        normalizeInto(result, -sign, layer + 1, -magnitude);
        return;
    }

    writeDecimal(result, 1, 0, 1);
}

export function pow10(value: i32): i32 {
    const result = allocateDecimal();
    pow10Into(result, value);
    return result;
}

export function floorInto(result: i32, value: i32): void {
    const sign = readSign(value);
    const layer = readLayer(value);
    const magnitude = readMagnitude(value);
    if (isNaN(sign) || isNaN(layer) || isNaN(magnitude)) {
        writeNaN(result);
        return;
    }
    if (layer !== 0) {
        writeDecimal(result, sign, layer, magnitude);
        return;
    }
    writeNumber(result, Math.floor(sign * magnitude));
}

export function ceilInto(result: i32, value: i32): void {
    const sign = readSign(value);
    const layer = readLayer(value);
    const magnitude = readMagnitude(value);
    if (isNaN(sign) || isNaN(layer) || isNaN(magnitude)) {
        writeNaN(result);
        return;
    }
    if (layer !== 0) {
        writeDecimal(result, sign, layer, magnitude);
        return;
    }
    writeNumber(result, Math.ceil(sign * magnitude));
}

export function roundInto(result: i32, value: i32): void {
    const sign = readSign(value);
    const layer = readLayer(value);
    const magnitude = readMagnitude(value);
    if (isNaN(sign) || isNaN(layer) || isNaN(magnitude)) {
        writeNaN(result);
        return;
    }
    if (layer !== 0) {
        writeDecimal(result, sign, layer, magnitude);
        return;
    }
    writeNumber(result, Math.round(sign * magnitude));
}

export function round(value: i32): i32 {
    const result = allocateDecimal();
    roundInto(result, value);
    return result;
}

export function readString(handle: i32): string {
    const sign = readSign(handle);
    const layer = readLayer(handle);
    const magnitude = readMagnitude(handle);

    if (isNaN(sign) || isNaN(layer) || isNaN(magnitude)) return "NaN";
    if (sign === 0) return "0";

    if (layer === Infinity || magnitude === Infinity) {
        return sign < 0 ? "-Infinity" : "Infinity";
    }

    if (layer === 0) {
        return (sign * magnitude).toString();
    }

    const prefix = sign < 0 ? "-" : "";

    const exponent: f64 = Math.floor(magnitude);
    const mantissa = Math.pow(10, magnitude - exponent);
    const exponentString = (<i64>exponent).toString();

    if (layer === 1) {
        return prefix
            + mantissa.toString()
            + "e"
            + exponentString;
    }

    let ePrefix = "";

    for (let i: i32 = 1; i < <i32>layer; i++) {
        ePrefix += "e";
    }

    return prefix
        + ePrefix
        + mantissa.toString()
        + "e"
        + exponentString;
}

export function powInto(result: i32, base: i32, exponent: i32): void {
    const baseSign = readSign(base);
    const baseLayer = readLayer(base);
    const baseMagnitude = readMagnitude(base);
    const exponentSign = readSign(exponent);
    const exponentLayer = readLayer(exponent);
    const exponentMagnitude = readMagnitude(exponent);

    if (
        isNaN(baseSign) || isNaN(baseLayer) || isNaN(baseMagnitude) ||
        isNaN(exponentSign) || isNaN(exponentLayer) || isNaN(exponentMagnitude)
    ) {
        writeNaN(result);
        return;
    }

    if (baseSign === 0) {
        if (exponentSign === 0) {
            writeDecimal(result, 1, 0, 1);
        } else {
            writeDecimal(result, 0, 0, 0);
        }
        return;
    }
    if (baseSign === 1 && baseLayer === 0 && baseMagnitude === 1) {
        writeDecimal(result, 1, 0, 1);
        return;
    }
    if (exponentSign === 0) {
        writeDecimal(result, 1, 0, 1);
        return;
    }
    if (exponentSign === 1 && exponentLayer === 0 && exponentMagnitude === 1) {
        writeDecimal(result, baseSign, baseLayer, baseMagnitude);
        return;
    }

    absLog10Into(result, base);
    multiplyInto(result, result, exponent);
    pow10Into(result, result);

    if (baseSign < 0) {
        if (exponentLayer !== 0 || Math.floor(exponentMagnitude) !== exponentMagnitude) {
            writeNaN(result);
            return;
        }

        const integerExponent = exponentMagnitude;
        if ((<i64>integerExponent & 1) !== 0) {
            writeDecimal(
                result,
                -readSign(result),
                readLayer(result),
                readMagnitude(result),
            );
        }
    }
}

export function pow(base: i32, exponent: i32): i32 {
    const result = allocateDecimal();
    powInto(result, base, exponent);
    return result;
}

export function powUS(base: i32, exponent: i32): i32 {
    assertMutable(base);
    powInto(base, base, exponent);
    return base;
}

export function compareAbs(left: i32, right: i32): i32 {
    return compareAbsolute(
        readLayer(left), readMagnitude(left),
        readLayer(right), readMagnitude(right),
    );
}

export function eq(left: i32, right: i32): bool {
    return compare(left, right) === 0;
}

export function lt(left: i32, right: i32): bool {
    return compare(left, right) < 0;
}

export function lte(left: i32, right: i32): bool {
    return compare(left, right) <= 0;
}

export function gt(left: i32, right: i32): bool {
    return compare(left, right) > 0;
}

export function gte(left: i32, right: i32): bool {
    return compare(left, right) >= 0;
}

export function compare(left: i32, right: i32): i32 {
    const leftSign = readSign(left);
    const rightSign = readSign(right);
    if (leftSign > rightSign) return 1;
    if (leftSign < rightSign) return -1;
    return compareAbsolute(readLayer(left), readMagnitude(left), readLayer(right), readMagnitude(right)) * <i32>leftSign;
}

function boundaryLayer(boundary: i32): f64 {
    switch (boundary) {
        case 0: return 1;
        case 1: return 2;
        case 2: return 2;
        default: return NaN;
    }
}

function boundaryMagnitude(boundary: i32): f64 {
    switch (boundary) {
        case 0: return 308.25471555991675;
        case 1: return 15.954242509439325;
        case 2: return 308.25471555991675;
        default: return NaN;
    }
}

export function passesLayerBoundary(value: i32, boundary: i32): bool {
    const sign = readSign(value);

    if (sign === 0 || isNaN(sign)) {
        return false;
    }

    const layer = boundaryLayer(boundary);
    const magnitude = boundaryMagnitude(boundary);

    if (isNaN(layer) || isNaN(magnitude)) {
        return false;
    }

    return compareAbsolute(
        readLayer(value),
        readMagnitude(value),
        layer,
        magnitude
    ) > 0;
}

export function reachesLayerBoundary(value: i32, boundary: i32): bool {
    const sign = readSign(value);
    if (sign <= 0 || isNaN(sign)) return false;
    const layer = boundaryLayer(boundary);
    const magnitude = boundaryMagnitude(boundary);
    if (isNaN(layer) || isNaN(magnitude)) return false;
    return compareAbsolute(readLayer(value), readMagnitude(value), layer, magnitude) >= 0;
}

/**
 * clamps and writes into the value
 */
export function clampToBoundary(value: i32, boundary: i32): i32 {
    if (!passesLayerBoundary(value, boundary)) {
        return value;
    }

    const layer = boundaryLayer(boundary);
    const magnitude = boundaryMagnitude(boundary);

    writeDecimal(
        value,
        readSign(value),
        layer,
        magnitude
    );

    return value;
}

/** [/WASM] */
