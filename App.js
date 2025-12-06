import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';

const STORAGE_FILE = `${FileSystem.documentDirectory}filament-data.json`;

const defaultConfig = {
  weightUnit: 'g',
  lowStockThreshold: 200,
  staleDays: 90,
};

const defaultData = {
  spools: [],
  prints: [],
  purchases: [],
  config: defaultConfig,
};

export default function App() {
  const [data, setData] = useState(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [spoolForm, setSpoolForm] = useState({
    brand: '',
    material: 'PLA',
    color: '',
    initialWeight: '',
    remainingWeight: '',
    openedAt: '',
  });
  const [usageForm, setUsageForm] = useState({
    spoolId: '',
    gramsUsed: '',
    note: '',
  });
  const [purchaseForm, setPurchaseForm] = useState({
    brand: '',
    material: 'PLA',
    color: '',
    weight: '',
    price: '',
    date: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const info = await FileSystem.getInfoAsync(STORAGE_FILE);
        if (info.exists) {
          const fileContent = await FileSystem.readAsStringAsync(STORAGE_FILE);
          const parsed = JSON.parse(fileContent);
          setData({ ...defaultData, ...parsed, config: { ...defaultConfig, ...(parsed.config || {}) } });
        }
      } catch (error) {
        console.warn('读取本地数据失败，将使用空数据。', error);
      } finally {
        setLoaded(true);
      }
    };

    loadData();
  }, []);

  const saveData = async (nextData) => {
    setData(nextData);
    try {
      await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(nextData, null, 2));
    } catch (error) {
      Alert.alert('保存失败', '写入本地文件时出错，请重试。');
      console.warn('写入失败', error);
    }
  };

  const handleAddSpool = () => {
    const initialWeight = parseFloat(spoolForm.initialWeight);
    const remainingWeight = spoolForm.remainingWeight ? parseFloat(spoolForm.remainingWeight) : initialWeight;

    if (!spoolForm.brand.trim() || !spoolForm.color.trim() || Number.isNaN(initialWeight)) {
      Alert.alert('请填写品牌、颜色和入库重量');
      return;
    }

    const now = new Date();
    const openedAt = spoolForm.openedAt || now.toISOString().slice(0, 10);

    const newSpool = {
      id: `${Date.now()}`,
      brand: spoolForm.brand.trim(),
      material: spoolForm.material,
      color: spoolForm.color.trim(),
      initialWeight,
      remainingWeight: Number.isNaN(remainingWeight) ? initialWeight : remainingWeight,
      openedAt,
    };

    const nextData = { ...data, spools: [...data.spools, newSpool] };
    saveData(nextData);
    setSpoolForm({ brand: '', material: 'PLA', color: '', initialWeight: '', remainingWeight: '', openedAt: '' });
  };

  const handleLogPrint = () => {
    const gramsUsed = parseFloat(usageForm.gramsUsed);
    if (!usageForm.spoolId || Number.isNaN(gramsUsed) || gramsUsed <= 0) {
      Alert.alert('请选择线材并填写消耗量');
      return;
    }

    const target = data.spools.find((s) => s.id === usageForm.spoolId);
    if (!target) {
      Alert.alert('未找到线材');
      return;
    }

    const remaining = Math.max(0, (target.remainingWeight || 0) - gramsUsed);
    const updatedSpools = data.spools.map((s) => (s.id === target.id ? { ...s, remainingWeight: remaining } : s));

    const logEntry = {
      id: `${Date.now()}`,
      spoolId: target.id,
      gramsUsed,
      note: usageForm.note.trim(),
      usedAt: new Date().toISOString(),
    };

    const nextData = { ...data, spools: updatedSpools, prints: [logEntry, ...data.prints] };
    saveData(nextData);
    setUsageForm({ spoolId: usageForm.spoolId, gramsUsed: '', note: '' });
  };

  const handleAddPurchase = () => {
    const weight = parseFloat(purchaseForm.weight);
    const price = parseFloat(purchaseForm.price);

    if (!purchaseForm.brand.trim() || Number.isNaN(weight) || Number.isNaN(price)) {
      Alert.alert('请填写品牌、重量与价格');
      return;
    }

    const date = purchaseForm.date || new Date().toISOString().slice(0, 10);
    const purchase = {
      id: `${Date.now()}`,
      ...purchaseForm,
      weight,
      price,
      date,
    };

    const nextData = { ...data, purchases: [purchase, ...data.purchases] };
    saveData(nextData);
    setPurchaseForm({ brand: '', material: 'PLA', color: '', weight: '', price: '', date: '' });
  };

  const handleConfigChange = (field, value) => {
    const parsed = field === 'weightUnit' ? value : parseFloat(value);
    if (field !== 'weightUnit' && (Number.isNaN(parsed) || parsed <= 0)) {
      Alert.alert('阈值必须大于 0');
      return;
    }
    const nextConfig = { ...data.config, [field]: parsed };
    const nextData = { ...data, config: nextConfig };
    saveData(nextData);
  };

  const lowStockReminders = useMemo(
    () =>
      data.spools.filter(
        (spool) => spool.remainingWeight <= (data.config.lowStockThreshold || defaultConfig.lowStockThreshold),
      ),
    [data],
  );

  const staleSpools = useMemo(() => {
    const days = data.config.staleDays || defaultConfig.staleDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.spools.filter((spool) => new Date(spool.openedAt) <= cutoff);
  }, [data]);

  const yearlySpend = useMemo(() => {
    const stats = {};
    data.purchases.forEach((item) => {
      const year = (item.date || '').slice(0, 4);
      if (!year) return;
      if (!stats[year]) stats[year] = { spend: 0, weight: 0 };
      stats[year].spend += item.price || 0;
      stats[year].weight += item.weight || 0;
    });
    return stats;
  }, [data.purchases]);

  const renderSpools = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>线材列表</Text>
      {data.spools.length === 0 ? (
        <Text style={styles.muted}>暂无线材</Text>
      ) : (
        data.spools.map((spool) => (
          <View key={spool.id} style={styles.listItem}>
            <Text style={styles.itemTitle}>
              {spool.brand} · {spool.material} · {spool.color}
            </Text>
            <Text style={styles.muted}>
              剩余 {spool.remainingWeight}{data.config.weightUnit} / 入库 {spool.initialWeight}{data.config.weightUnit} · 开封 {spool.openedAt}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  const renderReminders = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>提醒</Text>
      <Text style={styles.subTitle}>低库存 (≤ {data.config.lowStockThreshold}{data.config.weightUnit})</Text>
      {lowStockReminders.length === 0 ? (
        <Text style={styles.muted}>无</Text>
      ) : (
        lowStockReminders.map((spool) => (
          <Text key={spool.id} style={styles.warning}>
            {spool.brand} {spool.color} 剩余 {spool.remainingWeight}{data.config.weightUnit}
          </Text>
        ))
      )}
      <Text style={[styles.subTitle, { marginTop: 12 }]}>开封超期 ({data.config.staleDays} 天)</Text>
      {staleSpools.length === 0 ? (
        <Text style={styles.muted}>无</Text>
      ) : (
        staleSpools.map((spool) => (
          <Text key={spool.id} style={styles.warning}>
            {spool.brand} {spool.color} 开封于 {spool.openedAt}
          </Text>
        ))
      )}
    </View>
  );

  const renderStats = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>年度采购统计</Text>
      {Object.keys(yearlySpend).length === 0 ? (
        <Text style={styles.muted}>暂无记录</Text>
      ) : (
        Object.entries(yearlySpend).map(([year, value]) => (
          <View key={year} style={styles.listItem}>
            <Text style={styles.itemTitle}>{year}</Text>
            <Text style={styles.muted}>
              花费 ¥{value.spend.toFixed(2)} · 重量 {value.weight}{data.config.weightUnit}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>加载中…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>3D 打印耗材助手（离线）</Text>
        <Text style={styles.description}>
          所有数据均存储在本地文件（{STORAGE_FILE}）。通过添加线材、记录打印消耗、登记采购，系统会自动扣减库存并提供低库存、开封超期提醒。
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>配置</Text>
          <View style={styles.formRow}>
            <Text style={styles.label}>重量单位</Text>
            <Picker
              selectedValue={data.config.weightUnit}
              style={styles.picker}
              onValueChange={(value) => handleConfigChange('weightUnit', value)}
            >
              <Picker.Item label="克 (g)" value="g" />
              <Picker.Item label="千克 (kg)" value="kg" />
            </Picker>
          </View>
          <View style={styles.formRow}>
            <Text style={styles.label}>低库存阈值</Text>
            <TextInput
              value={String(data.config.lowStockThreshold)}
              onChangeText={(text) => handleConfigChange('lowStockThreshold', text)}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.label}>开封天数提醒</Text>
            <TextInput
              value={String(data.config.staleDays)}
              onChangeText={(text) => handleConfigChange('staleDays', text)}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>添加线材</Text>
          <FormRow label="品牌">
            <TextInput
              value={spoolForm.brand}
              onChangeText={(text) => setSpoolForm({ ...spoolForm, brand: text })}
              style={styles.input}
            />
          </FormRow>
          <FormRow label="材质">
            <Picker
              selectedValue={spoolForm.material}
              style={styles.picker}
              onValueChange={(value) => setSpoolForm({ ...spoolForm, material: value })}
            >
              <Picker.Item label="PLA" value="PLA" />
              <Picker.Item label="PETG" value="PETG" />
              <Picker.Item label="ABS" value="ABS" />
              <Picker.Item label="TPU" value="TPU" />
            </Picker>
          </FormRow>
          <FormRow label="颜色">
            <TextInput
              value={spoolForm.color}
              onChangeText={(text) => setSpoolForm({ ...spoolForm, color: text })}
              style={styles.input}
            />
          </FormRow>
          <FormRow label={`入库重量 (${data.config.weightUnit})`}>
            <TextInput
              value={spoolForm.initialWeight}
              onChangeText={(text) => setSpoolForm({ ...spoolForm, initialWeight: text })}
              keyboardType="numeric"
              style={styles.input}
            />
          </FormRow>
          <FormRow label={`当前重量 (${data.config.weightUnit})`}>
            <TextInput
              value={spoolForm.remainingWeight}
              onChangeText={(text) => setSpoolForm({ ...spoolForm, remainingWeight: text })}
              keyboardType="numeric"
              placeholder="默认等于入库重量"
              style={styles.input}
            />
          </FormRow>
          <FormRow label="开封日期 (YYYY-MM-DD)">
            <TextInput
              value={spoolForm.openedAt}
              onChangeText={(text) => setSpoolForm({ ...spoolForm, openedAt: text })}
              placeholder="留空自动使用今日"
              style={styles.input}
            />
          </FormRow>
          <Pressable style={styles.button} onPress={handleAddSpool}>
            <Text style={styles.buttonText}>保存</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>记录打印消耗</Text>
          <FormRow label="线材">
            <Picker
              selectedValue={usageForm.spoolId}
              style={styles.picker}
              onValueChange={(value) => setUsageForm({ ...usageForm, spoolId: value })}
            >
              <Picker.Item label="请选择" value="" />
              {data.spools.map((spool) => (
                <Picker.Item
                  key={spool.id}
                  label={`${spool.brand} ${spool.color} (${spool.remainingWeight}${data.config.weightUnit})`}
                  value={spool.id}
                />
              ))}
            </Picker>
          </FormRow>
          <FormRow label={`消耗重量 (${data.config.weightUnit})`}>
            <TextInput
              value={usageForm.gramsUsed}
              onChangeText={(text) => setUsageForm({ ...usageForm, gramsUsed: text })}
              keyboardType="numeric"
              style={styles.input}
            />
          </FormRow>
          <FormRow label="备注">
            <TextInput
              value={usageForm.note}
              onChangeText={(text) => setUsageForm({ ...usageForm, note: text })}
              style={styles.input}
            />
          </FormRow>
          <Pressable style={styles.button} onPress={handleLogPrint}>
            <Text style={styles.buttonText}>记录并扣减</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>采购登记</Text>
          <FormRow label="品牌">
            <TextInput
              value={purchaseForm.brand}
              onChangeText={(text) => setPurchaseForm({ ...purchaseForm, brand: text })}
              style={styles.input}
            />
          </FormRow>
          <FormRow label="材质">
            <Picker
              selectedValue={purchaseForm.material}
              style={styles.picker}
              onValueChange={(value) => setPurchaseForm({ ...purchaseForm, material: value })}
            >
              <Picker.Item label="PLA" value="PLA" />
              <Picker.Item label="PETG" value="PETG" />
              <Picker.Item label="ABS" value="ABS" />
              <Picker.Item label="TPU" value="TPU" />
            </Picker>
          </FormRow>
          <FormRow label="颜色">
            <TextInput
              value={purchaseForm.color}
              onChangeText={(text) => setPurchaseForm({ ...purchaseForm, color: text })}
              style={styles.input}
            />
          </FormRow>
          <FormRow label={`重量 (${data.config.weightUnit})`}>
            <TextInput
              value={purchaseForm.weight}
              onChangeText={(text) => setPurchaseForm({ ...purchaseForm, weight: text })}
              keyboardType="numeric"
              style={styles.input}
            />
          </FormRow>
          <FormRow label="价格 (¥)">
            <TextInput
              value={purchaseForm.price}
              onChangeText={(text) => setPurchaseForm({ ...purchaseForm, price: text })}
              keyboardType="numeric"
              style={styles.input}
            />
          </FormRow>
          <FormRow label="日期 (YYYY-MM-DD)">
            <TextInput
              value={purchaseForm.date}
              onChangeText={(text) => setPurchaseForm({ ...purchaseForm, date: text })}
              placeholder="留空自动使用今日"
              style={styles.input}
            />
          </FormRow>
          <Pressable style={styles.button} onPress={handleAddPurchase}>
            <Text style={styles.buttonText}>保存</Text>
          </Pressable>
        </View>

        {renderReminders()}
        {renderStats()}
        {renderSpools()}
      </ScrollView>
    </SafeAreaView>
  );
}

const FormRow = ({ label, children }) => (
  <View style={styles.formRow}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.formControl}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#4a4a4a',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  formRow: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  formControl: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
  },
  input: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  picker: {
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#0084ff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listItem: {
    paddingVertical: 8,
    borderBottomColor: '#e6e6e6',
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontWeight: '600',
  },
  muted: {
    color: '#666',
    marginTop: 2,
  },
  warning: {
    color: '#d46b08',
    marginTop: 4,
  },
});

