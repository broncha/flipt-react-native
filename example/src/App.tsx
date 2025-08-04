import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { FliptProvider, useFliptBoolean } from '@broncha/react-native-flipt';

export default function App() {
  // useEffect(() => {
  //   const client = new FliptClient({
  //     url: 'https://fliph.tunn.vantagebit.com',
  //     updateInterval: 240,
  //     fetchMode: 'streaming',
  //   });

  //   try {
  //     const variant = client.evaluateVariant({
  //       flagKey: 'VARIANT_TEST',
  //       entityId: 'asdasdas',
  //       context: {},
  //     });
  //     console.log(variant);

  //     const bool1 = client.evaluateBoolean({
  // flagKey: 'ENABLE_CLEAR_COURESE_PROGRESS',
  // entityId: 'asdasd',
  // context: {
  //   email: 'broncha@rajesharma.com',
  // },
  //     });
  //     console.log('broncha@rajesharma.com', bool1);

  //     const bool2 = client.evaluateBoolean({
  //       flagKey: 'ENABLE_CLEAR_COURESE_PROGRESS',
  //       entityId: 'asdfasdfasdfsd',
  //       context: {
  //         email: 'broncha@example.com',
  //       },
  //     });

  //     console.log('broncha@example.com', bool2);
  //   } catch (e) {
  //     console.log('Evaluation failed', e.inner?.message);
  //   }
  // });
  return (
    <View style={styles.container}>
      <FliptProvider
        options={{
          environment: 'default',
          namespace: 'default',
          url: 'https://fliph.tunn.vantagebit.com',
          fetchMode: 'polling',
        }}
      >
        <Text>asdasdasd</Text>
        <MyComponent />
      </FliptProvider>
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

const MyComponent = () => {
  const result = useFliptBoolean(
    'enable_clear_courese_progress',
    false,
    'asdasd',
    {
      email: 'broncha@rajesharma.me',
    }
  );
  console.log(result);
  return <Text>{JSON.stringify(result ?? {}, null, 2)}</Text>;
};
