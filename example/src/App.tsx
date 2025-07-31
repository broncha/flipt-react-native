import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { FliptClient } from 'react-native-flipt';

export default function App() {
  useEffect(() => {
    const client = new FliptClient({
      url: 'https://fliph.tunn.vantagebit.com',
      updateInterval: 240,
      fetchMode: 'streaming',
    });

    try {
      const variant = client.evaluateVariant({
        flagKey: 'VARIANT_TEST',
        entityId: 'asdasdas',
        context: {},
      });
      console.log(variant);

      const bool1 = client.evaluateBoolean({
        flagKey: 'ENABLE_CLEAR_COURESE_PROGRESS',
        entityId: 'asdasd',
        context: {
          email: 'broncha@rajesharma.com',
        },
      });

      const bool2 = client.evaluateBoolean({
        flagKey: 'ENABLE_CLEAR_COURESE_PROGRESS',
        entityId: 'asdfasdfasdfsd',
        context: {
          email: 'broncha@hermaid.me',
        },
      });

      console.log('broncha@rajesharma.com', bool1);
      console.log('broncha@hermaid.me', bool2);
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
