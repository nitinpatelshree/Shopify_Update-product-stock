import {
  Card,
  Page,
  Layout,
  TextContainer,
  Image,
  Stack,
  Link,
  Heading,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { trophyImage } from "../assets";

import { ProductsCard } from "../components";
import { StockUpdate } from '../components/StockUpdate';

export default function HomePage() {
  return (
    <Page narrowWidth>
      <TitleBar title="Stock Update" primaryAction={null} />
      <Layout>
        <Layout.Section>  
          <Card sectioned>
            <Stack
              wrap={false}
              spacing="extraTight"
              distribution="trailing"
              alignment="center"
            >
              <Stack.Item fill>
                <TextContainer spacing="loose">
                  <StockUpdate />
                </TextContainer>
              </Stack.Item>
            </Stack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
