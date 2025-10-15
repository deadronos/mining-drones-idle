import type { ReactElement } from 'react'
import * as React from 'react';
import './App.css'
import { Theme, ThemePanel, Box, Card, Flex, Grid, Container } from "@radix-ui/themes"





function App(): ReactElement {


  return (
    <Theme appearance={'dark'} hasBackground={true} accentColor={'indigo'}>
      <Container width="100%" maxWidth="100%">
        <Flex>
          <Grid columns="3" gap="3" width="100%">
            <Card>
              <Box gridColumn="1" >
                1
              </Box>
            </Card>
            <Card>
              <Box gridColumn="2">
                2
              </Box>
            </Card>
            <Card>
              <Box gridColumn="3">
                3
              </Box>
            </Card>
          </Grid>
        </Flex>
      </Container>
      <ThemePanel />
    </Theme>
  )
}

export default App
