export const data = `
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/styles/styles.xsl"?>
<MTConnectStreams xmlns:m="urn:mtconnect.org:MTConnectStreams:2.0" xmlns="urn:mtconnect.org:MTConnectStreams:2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mtconnect.org:MTConnectStreams:2.0 /schemas/MTConnectStreams_2.0.xsd">
<Header creationTime="2023-05-26T20:23:23Z" sender="e9d235224086" instanceId="1685065313" version="2.1.0.2" deviceModelChangeTime="2023-05-26T01:41:53.263244Z" bufferSize="131072" nextSequence="15455207" firstSequence="15324135" lastSequence="15455206"/>
<Streams>
  <DeviceStream name="Agent" uuid="5ae6779f-7bde-584d-995b-6acb0f7ccb00">
<ComponentStream component="Adapter" name="127.0.0.1:7878" componentId="_1b99d6086a">
<Samples>
  <AssetUpdateRate dataItemId="_1b99d6086a_asset_update_rate" sequence="12" statistic="AVERAGE" timestamp="2023-05-26T01:41:53.264943Z">UNAVAILABLE</AssetUpdateRate>
  <ObservationUpdateRate dataItemId="_1b99d6086a_observation_update_rate" duration="10" sequence="15455206" statistic="AVERAGE" timestamp="2023-05-26T20:23:14.625441Z">0</ObservationUpdateRate>
</Samples>
<Events>
<AdapterSoftwareVersion dataItemId="_1b99d6086a_adapter_software_version" sequence="13" timestamp="2023-05-26T01:41:53.264952Z">UNAVAILABLE</AdapterSoftwareVersion>
  <AdapterURI dataItemId="_1b99d6086a_adapter_uri" sequence="1" timestamp="2023-05-26T01:41:53.264766Z">_127.0.0.1_7878</AdapterURI>
<ConnectionStatus dataItemId="_1b99d6086a_connection_status" sequence="15409304" timestamp="2023-05-26T20:19:32.023131Z">ESTABLISHED</ConnectionStatus>
  <MTConnectVersion dataItemId="_1b99d6086a_mtconnect_version" sequence="8" timestamp="2023-05-26T01:41:53.264918Z">UNAVAILABLE</MTConnectVersion>
  </Events>
  </ComponentStream>
  <ComponentStream component="Agent" name="Agent" componentId="agent_5ae6779f">
<Events>
  <AssetChanged assetType="UNAVAILABLE" dataItemId="agent_5ae6779f_asset_chg" sequence="6" timestamp="2023-05-26T01:41:53.264904Z">UNAVAILABLE</AssetChanged>
  <AssetCountDataSet count="0" dataItemId="agent_5ae6779f_asset_count" sequence="9" timestamp="2023-05-26T01:41:53.264923Z">UNAVAILABLE</AssetCountDataSet>
  <AssetRemoved assetType="UNAVAILABLE" dataItemId="agent_5ae6779f_asset_rem" sequence="7" timestamp="2023-05-26T01:41:53.264913Z">UNAVAILABLE</AssetRemoved>
  <Availability dataItemId="agent_avail" sequence="63" timestamp="2023-05-26T01:41:53.265283Z">AVAILABLE</Availability>
  <DeviceAdded dataItemId="device_added" sequence="62" timestamp="2023-05-26T01:41:53.265275Z">000</DeviceAdded>
  <DeviceChanged dataItemId="device_changed" sequence="5" timestamp="2023-05-26T01:41:53.2649Z">UNAVAILABLE</DeviceChanged>
  <DeviceRemoved dataItemId="device_removed" sequence="4" timestamp="2023-05-26T01:41:53.264896Z">UNAVAILABLE</DeviceRemoved>
  </Events>
  </ComponentStream>
  </DeviceStream>
  <DeviceStream name="VMC-3Axis" uuid="000">
<ComponentStream component="Rotary" name="C" componentId="c1">
<Samples>
  <SpindleSpeed dataItemId="c2" name="Sspeed" sequence="15420955" subType="ACTUAL" timestamp="2023-05-26T20:20:51.296652Z">3400</SpindleSpeed>
  <SpindleSpeed dataItemId="c3" name="Sovr" sequence="15409280" subType="OVERRIDE" timestamp="2023-05-26T20:19:31.022115Z">UNAVAILABLE</SpindleSpeed>
  <Load dataItemId="cl3" name="Cload" sequence="26" timestamp="2023-05-26T01:41:53.26504Z">UNAVAILABLE</Load>
</Samples>
<Events>
<RotaryMode dataItemId="cm" name="Cmode" sequence="21" timestamp="2023-05-26T01:41:53.265009Z">SPINDLE</RotaryMode>
</Events>
<Condition>
<Unavailable dataItemId="Cloadc" sequence="15409282" timestamp="2023-05-26T20:19:31.022132Z" type="LOAD"/>
<Unavailable dataItemId="Csystem" sequence="25" timestamp="2023-05-26T01:41:53.265035Z" type="SYSTEM"/>
  </Condition>
  </ComponentStream>
  <ComponentStream component="Controller" name="controller" componentId="cn1">
<Events>
  <EmergencyStop dataItemId="estop" sequence="15409306" timestamp="2023-05-26T20:19:42.344686Z">ARMED</EmergencyStop>
  <Message dataItemId="msg" sequence="38" timestamp="2023-05-26T01:41:53.265123Z">UNAVAILABLE</Message>
</Events>
<Condition>
<Unavailable dataItemId="clp" sequence="15409293" timestamp="2023-05-26T20:19:31.022237Z" type="LOGIC_PROGRAM"/>
<Unavailable dataItemId="motion" sequence="47" timestamp="2023-05-26T01:41:53.265183Z" type="MOTION_PROGRAM"/>
<Unavailable dataItemId="system" sequence="49" timestamp="2023-05-26T01:41:53.265193Z" type="SYSTEM"/>
  </Condition>
  </ComponentStream>
  <ComponentStream component="Coolant" name="coolant" componentId="cool">
<Condition>
  <Unavailable dataItemId="clow" sequence="15409291" timestamp="2023-05-26T20:19:31.022219Z" type="LEVEL"/>
<Unavailable dataItemId="coolantmotor" sequence="51" timestamp="2023-05-26T01:41:53.265206Z" type="ACTUATOR"/>
<Unavailable dataItemId="coolpres" sequence="42" timestamp="2023-05-26T01:41:53.265151Z" type="PRESSURE"/>
<Unavailable dataItemId="filter" sequence="18" timestamp="2023-05-26T01:41:53.264989Z" type="X:FILTER"/>
  </Condition>
  </ComponentStream>
  <ComponentStream component="Device" name="VMC-3Axis" componentId="dev">
<Events>
  <Availability dataItemId="avail" sequence="15409277" timestamp="2023-05-26T20:19:31.02208Z">UNAVAILABLE</Availability>
  <AssetChanged assetType="UNAVAILABLE" dataItemId="dev_asset_chg" sequence="22" timestamp="2023-05-26T01:41:53.265014Z">UNAVAILABLE</AssetChanged>
  <AssetCountDataSet count="0" dataItemId="dev_asset_count" sequence="60" timestamp="2023-05-26T01:41:53.265259Z">UNAVAILABLE</AssetCountDataSet>
  <AssetRemoved assetType="UNAVAILABLE" dataItemId="dev_asset_rem" sequence="59" timestamp="2023-05-26T01:41:53.265254Z">UNAVAILABLE</AssetRemoved>
  </Events>
  </ComponentStream>
  <ComponentStream component="Electric" name="electric" componentId="el">
<Events>
  <PowerState dataItemId="p2" name="power" sequence="15409299" timestamp="2023-05-26T20:19:31.022289Z">UNAVAILABLE</PowerState>
  </Events>
  </ComponentStream>
  <ComponentStream component="Hydraulic" name="hydrolic" componentId="hsys">
<Condition>
  <Unavailable dataItemId="hlow" sequence="15409300" timestamp="2023-05-26T20:19:31.022299Z" type="LEVEL"/>
<Unavailable dataItemId="hpres" sequence="15409301" timestamp="2023-05-26T20:19:31.022307Z" type="PRESSURE"/>
<Unavailable dataItemId="htemp" sequence="15409302" timestamp="2023-05-26T20:19:31.022318Z" type="TEMPERATURE"/>
  </Condition>
  </ComponentStream>
  <ComponentStream component="Path" name="path" componentId="pth">
<Samples>
  <PathFeedrate dataItemId="Fovr" sequence="15409298" timestamp="2023-05-26T20:19:31.02228Z">UNAVAILABLE</PathFeedrate>
  <PathFeedrate dataItemId="Frt" sequence="15455203" timestamp="2023-05-26T20:22:56.914158Z">0</PathFeedrate>
  <PathPosition dataItemId="Ppos" sequence="53" subType="ACTUAL" timestamp="2023-05-26T01:41:53.265216Z">UNAVAILABLE</PathPosition>
</Samples>
<Events>
<Block dataItemId="cn2" name="block" sequence="15455124" timestamp="2023-05-26T20:22:56.569898Z">X-1.407271 Y-0.349412</Block>
<ControllerMode dataItemId="cn3" name="mode" sequence="15409295" timestamp="2023-05-26T20:19:31.022255Z">UNAVAILABLE</ControllerMode>
  <Line dataItemId="cn4" name="line" sequence="15455118" timestamp="2023-05-26T20:22:56.569898Z">282</Line>
  <Program dataItemId="cn5" name="program" sequence="15409284" timestamp="2023-05-26T20:19:31.022153Z">UNAVAILABLE</Program>
  <Execution dataItemId="cn6" name="execution" sequence="15455204" timestamp="2023-05-26T20:22:56.914158Z">STOPPED</Execution>
  <ToolId dataItemId="cnt1" name="tool_id" sequence="33" timestamp="2023-05-26T01:41:53.265089Z">UNAVAILABLE</ToolId>
  </Events>
  </ComponentStream>
  <ComponentStream component="Linear" name="X" componentId="x1">
<Samples>
  <Load dataItemId="n3" name="Xload" sequence="30" timestamp="2023-05-26T01:41:53.265068Z">UNAVAILABLE</Load>
  <Position dataItemId="x2" name="Xact" sequence="15455201" subType="ACTUAL" timestamp="2023-05-26T20:22:56.900337Z">-1.4020783901</Position>
  <Position dataItemId="x3" name="Xcom" sequence="15455199" subType="COMMANDED" timestamp="2023-05-26T20:22:56.887996Z">-1.4035134837</Position>
</Samples>
<Condition>
<Unavailable dataItemId="Xloadc" sequence="15409286" timestamp="2023-05-26T20:19:31.022169Z" type="LOAD"/>
<Unavailable dataItemId="Xsystem" sequence="19" timestamp="2023-05-26T01:41:53.264995Z" type="SYSTEM"/>
  </Condition>
  </ComponentStream>
  <ComponentStream component="Linear" name="Y" componentId="y1">
<Samples>
  <Position dataItemId="y2" name="Yact" sequence="15455202" subType="ACTUAL" timestamp="2023-05-26T20:22:56.900337Z">-0.3674970865</Position>
  <Position dataItemId="y3" name="Ycom" sequence="15455200" subType="COMMANDED" timestamp="2023-05-26T20:22:56.887996Z">-0.3624990077</Position>
  <Load dataItemId="y4" name="Yload" sequence="35" timestamp="2023-05-26T01:41:53.2651Z">UNAVAILABLE</Load>
</Samples>
<Condition>
<Unavailable dataItemId="Yloadc" sequence="15409289" timestamp="2023-05-26T20:19:31.022199Z" type="LOAD"/>
<Unavailable dataItemId="Ysystem" sequence="39" timestamp="2023-05-26T01:41:53.265128Z" type="SYSTEM"/>
  </Condition>
  </ComponentStream>
  <ComponentStream component="Linear" name="Z" componentId="z1">
<Samples>
  <Position dataItemId="z2" name="Zact" sequence="15422053" subType="ACTUAL" timestamp="2023-05-26T20:20:55.981237Z">-0.1000000015</Position>
  <Position dataItemId="z3" name="Zcom" sequence="15422045" subType="COMMANDED" timestamp="2023-05-26T20:20:55.95665Z">-0.1</Position>
  <Load dataItemId="z4" name="Zload" sequence="44" timestamp="2023-05-26T01:41:53.265164Z">UNAVAILABLE</Load>
</Samples>
<Condition>
<Unavailable dataItemId="Zloadc" sequence="15409294" timestamp="2023-05-26T20:19:31.022246Z" type="LOAD"/>
<Unavailable dataItemId="Zsystem" sequence="46" timestamp="2023-05-26T01:41:53.265175Z" type="SYSTEM"/>
  </Condition>
  </ComponentStream>
  </DeviceStream>
  </Streams>
  </MTConnectStreams>
`;
