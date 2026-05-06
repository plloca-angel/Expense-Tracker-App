import { Svg, Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
};

export function AppLogo({ size = 18 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image" aria-label="App logo">
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3B82F6" />
          <Stop offset="1" stopColor="#14B8A6" />
        </LinearGradient>
      </Defs>
      <Rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g)" />
      {/* Down arrow */}
      <Path
        d="M26 18c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v18.2l3.1-3.1c.8-.8 2.1-.8 2.9 0l1.7 1.7c.8.8.8 2.1 0 2.9L34.4 48c-.4.4-.9.6-1.4.6s-1-.2-1.4-.6l-9.2-9.2c-.8-.8-.8-2.1 0-2.9l1.7-1.7c.8-.8 2.1-.8 2.9 0l3.1 3.1V18z"
        fill="#fff"
        opacity={0.92}
      />
      {/* Up arrow */}
      <Path
        d="M38 46c0 1.1-.9 2-2 2h-3c-1.1 0-2-.9-2-2V27.8l-3.1 3.1c-.8.8-2.1.8-2.9 0l-1.7-1.7c-.8-.8-.8-2.1 0-2.9L29.6 16c.4-.4.9-.6 1.4-.6s1 .2 1.4.6l9.2 9.2c.8.8.8 2.1 0 2.9l-1.7 1.7c-.8.8-2.1.8-2.9 0l-3.1-3.1V46z"
        fill="#0B1220"
        opacity={0.18}
      />
    </Svg>
  );
}

