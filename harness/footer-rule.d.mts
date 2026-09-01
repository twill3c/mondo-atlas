/** harness/footer-rule.mjs の型。検品器(node)とテスト(vitest)の双方から使う。 */

export type FooterLink = { label: string; href: string };

export type FooterProbe = {
  text: string;
  links: FooterLink[];
  position: string;
  bottom: string;
  height?: number;
};

export declare const REQUIRED_ORDER: string[];
export declare const COPYRIGHT: string;
export declare function checkFooter(f: FooterProbe): string[];
