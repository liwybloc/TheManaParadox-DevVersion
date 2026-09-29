import { createF64View, memory, namedWasm } from "../../generated/_wasm$globals.js";

const DECIMAL_FORMAT_COMPONENT_COUNT = 4;
let decimalFormatTransfer: Float64Array | undefined;

export function formatDecimal(handle: number, decimals = 2, boundaryLabel = "Unknown"): string {
    return formatDecimals([handle], decimals, boundaryLabel)[0];
}

export function formatDecimals(
    handles: readonly number[],
    decimals: number | readonly number[] = 2,
    boundaryLabel: string | readonly string[] = "Unknown",
): string[] {
    if (handles.length === 0) return [];
    const transfer = getDecimalFormatTransfer();
    if (handles.length > transfer.length / DECIMAL_FORMAT_COMPONENT_COUNT) {
        throw new Error("Decimal format batch exceeds transfer capacity");
    }
    handles.forEach((handle, index) => { transfer[index] = handle; });
    namedWasm.writeDecimalFormatBatch(handles.length);
    return handles.map((_, index) => {
        const component = index * DECIMAL_FORMAT_COMPONENT_COUNT;
        return formatDecimalComponents(
            transfer[component],
            transfer[component + 1],
            transfer[component + 2],
            transfer[component + 3] !== 0,
            typeof decimals === "number" ? decimals : decimals[index],
            typeof boundaryLabel === "string" ? boundaryLabel : boundaryLabel[index],
        );
    });
}

export function formatDecimalCompact(handle: number): string {
    return formatDecimalsCompact([handle])[0];
}

export function formatNumber(value: number, decimals = 2): string {
    if (!Number.isFinite(value)) return "Unknown";
    if (Math.abs(value) >= 1e9) return value.toExponential(decimals).replace("+", "");
    return formatFixedNumber(value, decimals);
}

function formatFixedNumber(value: number, decimals: number): string {
    const [integer, fraction] = value.toFixed(decimals).split(".");
    const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction === undefined ? groupedInteger : `${groupedInteger}.${fraction}`;
}

export function formatDecimalsCompact(handles: readonly number[]): string[] {
    return formatDecimals(handles).map((value) => value.replace(/(\.\d*?[1-9])0+(?=e|$)|\.0+(?=e|$)/, "$1"));
}

export function formatCrystalGoal(handle: number | undefined): string {
    return handle === undefined ? "Placeholder" : `Reach ${formatDecimal(handle,)} Mana`;
}

export function formatCompletionTime(seconds: number, decimals = 2): string {
    if (seconds < 60) return `${seconds.toFixed(decimals)}s`;
    const minutes = Math.floor(seconds / 60);
    const secondWidth = decimals > 0 ? decimals + 3 : 2;
    const remainingSeconds = (seconds % 60).toFixed(decimals).padStart(secondWidth, "0");
    return `${minutes}:${remainingSeconds}`;
}

function formatScientificDecimal(value: string): string {
    const match = value.match(/^(-?)(e*)(\d+(?:\.\d+)?)e(-?\d+)$/);
    if (!match) return value;
    const [, sign, layerPrefix] = match;
    let mantissa = Number(match[3]);
    let exponent = Number(match[4]);
    let prefix = layerPrefix;
    const decimals = 2;
    const roundingScale = 10 ** decimals;

    while (Math.abs(exponent) >= 1e9) {
        prefix += "e";
        mantissa = Math.abs(exponent);
        exponent = Math.floor(Math.log10(mantissa));
        mantissa /= 10 ** exponent;
    }

    mantissa = Math.round(mantissa * roundingScale) / roundingScale;
    if (mantissa >= 10) {
        mantissa /= 10;
        exponent++;
    }
    return `${sign}${prefix}${mantissa.toFixed(decimals)}e${exponent}`;
}

function getDecimalFormatTransfer(): Float64Array {
    if (!decimalFormatTransfer || decimalFormatTransfer.buffer !== memory.buffer) {
        const capacity = namedWasm.decimalFormatTransferCapacity();
        decimalFormatTransfer = createF64View(
            namedWasm.decimalFormatTransferAddress(),
            capacity * DECIMAL_FORMAT_COMPONENT_COUNT,
        );
    }
    return decimalFormatTransfer;
}

function formatDecimalComponents(
    sign: number,
    layer: number,
    magnitude: number,
    atBoundary: boolean,
    decimals: number,
    boundaryLabel: string,
): string {
    if (atBoundary) return boundaryLabel;
    if (!Number.isFinite(sign) || !Number.isFinite(layer) || !Number.isFinite(magnitude)) return "Unknown";
    if (sign === 0) return (0).toFixed(decimals);
    if (layer === 0) {
        const value = sign * magnitude;
        if (Math.abs(value) >= 1e9) return value.toExponential(2).replace("+", "");
        return formatFixedNumber(value, decimals);
    }
    const exponent = Math.floor(magnitude);
    const mantissa = Math.pow(10, magnitude - exponent);
    const prefix = `${sign < 0 ? "-" : ""}${"e".repeat(Math.max(0, layer - 1))}`;
    return formatScientificDecimal(`${prefix}${mantissa}e${exponent}`);
}
