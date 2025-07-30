import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { FliptClient } from 'react-native-flipt';

export default function App() {
  useEffect(() => {
    const client = new FliptClient({
      url: 'https://fliph.tunn.vantagebit.com',
      clientToken: 'undefined',
      environment: 'default',
      namespace: 'default',
      reference: 'undefined',
      updateInterval: BigInt(240),
    });

    try {
      const variant = client.evaluateVariant({
        flagKey: 'VARIANT_TEST',
        entityId: 'asdasdas',
        context: new Map(),
      });
      console.log(variant);
    } catch (e) {
      console.log('evaluateVariant failed', e.inner?.message);
    }
  });
  return (
    <View style={styles.container}>
      <Text>asdasdasd</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
