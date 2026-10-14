import type { Work } from './types';
export function canonical(input?: string): string;
export function namesFor(work: Partial<Work> & {title:string}): string[];
export function editDistance(a:string,b:string,max?:number):number;
export function nameRank(query:string,name:string):number;
export function suggestWorks<T extends {title:string;titleKo?:string;aliases?:string[];creator?:string;creatorKo?:string}>(raw:string,works:T[],limit?:number):T[];
export function exactWorks<T extends {title:string;titleKo?:string;aliases?:string[];creator?:string;creatorKo?:string}>(raw:string,works:T[]):T[];

export function phoneticKeys(value?:string):string[];
export function hangulSound(value?:string):string;
export function soundKey(value?:string):string;
export function indexNamesFor(work:Partial<Work> & {title:string}):string[];
