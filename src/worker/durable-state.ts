import { DurableObject } from "cloudflare:workers";

export class MerchantState extends DurableObject {
	async get<T>(key: string): Promise<T | undefined> {
		return this.ctx.storage.get<T>(key);
	}

	async put<T>(key: string, value: T): Promise<void> {
		await this.ctx.storage.put(key, value);
	}

	async delete(key: string): Promise<void> {
		await this.ctx.storage.delete(key);
	}
}

type MerchantStateBinding = {
	MERCHANT_STATE: DurableObjectNamespace<MerchantState>;
};

export function merchantState(runtimeEnv: object): DurableObjectStub<MerchantState> {
	const namespace = (runtimeEnv as MerchantStateBinding).MERCHANT_STATE;
	return namespace.get(namespace.idFromName("jimporium"));
}
