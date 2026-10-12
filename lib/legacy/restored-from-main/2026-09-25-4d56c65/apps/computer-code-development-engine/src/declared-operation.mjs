import { COMPUTER_ENGINEERING_SPECIFICATION_ID } from "@red-cup-engineering/computer-system-engine/specification";
import { admit, collectTypeSystem } from "@red-cup-engineering/computer-data-engineering-services-section/type-system";
import { tm, ty } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation";
import { evaluate } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/eval";
import { descriptorTy, encodeDescriptor, decodeDescriptor } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/json-codec";
import { checkTy } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/typing";

/** True for a thenable: a real Promise or anything shaped like one. */
export function isPromiseLike(value) {
    return value !== null && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
}

/** The sole local precondition/body/postcondition evaluator, preserving sync results. */
export function evaluateBoundary(input, admitInput, move, admitOutput) {
    const admitted = admitInput(input);
    const output = move(admitted);
    return isPromiseLike(output) ? Promise.resolve(output).then(admitOutput) : admitOutput(output);
}

export const refusal = (code, message) => Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) });
const accepted = (value) => Object.freeze({ ok: true, value });
const validEffects = (effects) => Array.isArray(effects) && effects.every((effect) => typeof effect === "string" && effect.length > 0);
const establishedOperations = new WeakSet();

/** Deep-freeze a structured clone so an admitted operation body can never be mutated after admission. */
export function immutableBody(body) {
    const result = structuredClone(body);
    const pending = [result];
    const seen = new Set();
    while (pending.length > 0) {
        const current = pending.pop();
        if (seen.has(current))
            continue;
        seen.add(current);
        for (const value of Object.values(current))
            if (value !== null && typeof value === "object")
                pending.push(value);
        Object.freeze(current);
    }
    return result;
}

/** Admit one executable operation without binding a host implementation. */
export function admitOperation(definition) {
    if (establishedOperations.has(definition))
        return accepted(definition);
    if (!definition || definition.specification !== COMPUTER_ENGINEERING_SPECIFICATION_ID || typeof definition.id !== "string" || definition.id.length === 0)
        return refusal("InvalidOperation", "operation must name the universal computer engineering specification and a nonempty id");
    if (!definition.domain || !definition.codomain || typeof definition.domain.id !== "string" || typeof definition.codomain.id !== "string" || typeof definition.domain.schema === "undefined" || typeof definition.codomain.schema === "undefined" || !validEffects(definition.effects))
        return refusal("InvalidOperation", "operation needs admitted domain/codomain identities and string effects");
    if (!collectTypeSystem([definition.domain, definition.codomain]).ok)
        return refusal("InvalidOperation", "operation types must share established declarations");
    const body = definition.body;
    if (!body || !["sen", "capability-effect"].includes(body.kind))
        return refusal("InvalidOperation", "operation body must be sen or a capability effect");
    if (body.kind === "capability-effect" && (typeof body.capability !== "string" || body.capability.length === 0))
        return refusal("InvalidOperation", "capability effect needs a capability");
    if (body.kind === "sen" && (!body.term || !body.inputDescriptor || !body.outputDescriptor))
        return refusal("InvalidOperation", "sen body needs term and descriptors");
    let copiedBody;
    try {
        copiedBody = immutableBody(body);
        if (copiedBody.kind === "sen" && !checkTy([], copiedBody.term, ty.arrow(descriptorTy(copiedBody.inputDescriptor), descriptorTy(copiedBody.outputDescriptor))))
            return refusal("InvalidOperation", "SEN term does not typecheck against its descriptors");
    }
    catch (error) {
        return refusal("InvalidOperation", error instanceof Error ? error.message : String(error));
    }
    const operation = Object.freeze({ specification: COMPUTER_ENGINEERING_SPECIFICATION_ID, version: 1, id: definition.id, ...(typeof definition.description === "string" ? { description: definition.description } : {}), domain: definition.domain, codomain: definition.codomain, effects: Object.freeze([...new Set(definition.effects)]), body: copiedBody });
    establishedOperations.add(operation);
    return accepted(operation);
}

/** Declare a capability-effect operation through the one typed-operation admission path. */
export function declareCapabilityOperation(definition) {
    return admitOperation({
        specification: COMPUTER_ENGINEERING_SPECIFICATION_ID,
        id: definition.id,
        ...(typeof definition.description === "string" ? { description: definition.description } : {}),
        domain: definition.domain,
        codomain: definition.codomain,
        effects: definition.effects ?? [],
        body: { kind: "capability-effect", capability: definition.capability ?? definition.id },
    });
}

/** A thrown host failure keeps its own refusal code when it names one (`error.code`), else its class name, else ExecutionFailed. */
function caught(error) {
    const code = error !== null && typeof error === "object" && typeof error.code === "string" && error.code.length > 0 ? error.code : undefined;
    return refusal(code ?? (error instanceof Error ? error.name : "ExecutionFailed"), error instanceof Error ? error.message : String(error));
}

/** Execute through one path, preserving synchronous operations and awaiting only host promises. */
export function executeOperation(operation, input, options = {}) {
    try {
        const domain = options.resolveType ? options.resolveType(operation?.domain?.id) : operation?.domain;
        const codomain = options.resolveType ? options.resolveType(operation?.codomain?.id) : operation?.codomain;
        if (!domain || !codomain)
            return refusal("TypeUnavailable", "operation type identity cannot be resolved");
        if (!collectTypeSystem([operation.domain, operation.codomain, domain, codomain]).ok)
            return refusal("TypeIdentityConflict", "resolved types conflict with the operation's declarations");
        const admitted = admitOperation(operation);
        if (!admitted.ok)
            return admitted;
        const op = admitted.value;
        if (!op.effects.every(effect => (options.allowedEffects ?? []).includes(effect)))
            return refusal("EffectRefused", "operation effects exceed allowed effects");
        const predicate = (type, code) => (value) => {
            const result = admit(type, value);
            if (!result.ok)
                throw Object.assign(new TypeError(result.refusal.issues.map(issue => `${issue.path || "/"} ${issue.message}`).join("; ")), { code });
            return value;
        };
        const move = (value) => {
            if (op.body.kind === "sen") {
                const body = op.body;
                return decodeDescriptor(body.outputDescriptor, evaluate(tm.app(body.term, encodeDescriptor(body.inputDescriptor, value))));
            }
            if (!options.resolveHost)
                throw Object.assign(new Error("no host capability resolver"), { code: "HostUnavailable" });
            const invoke = (capability) => {
                if (typeof capability !== "function")
                    throw Object.assign(new Error("host capability is unavailable"), { code: "HostUnavailable" });
                return capability(value);
            };
            const host = options.resolveHost(op.body.capability, op.effects);
            return isPromiseLike(host) ? Promise.resolve(host).then(invoke) : invoke(host);
        };
        const output = evaluateBoundary(input, predicate(domain, "InvalidInput"), move, predicate(codomain, "InvalidOutput"));
        return isPromiseLike(output) ? Promise.resolve(output).then(accepted).catch(caught) : accepted(output);
    }
    catch (error) {
        return caught(error);
    }
}
