//
//  ContentView.swift
//  FamilyFeudClient
//
//  Created by Cameron Slash on 12/10/23.
//

import GameKit
import SwiftUI
import Observation

struct ContentView: View {
    @State private var game = MultiplayerService()
    var body: some View {
        VStack {
            Button("Choose Player") {
                if self.game.automatch {
                    GKMatchmaker.shared().cancel()
                    self.game.automatch = false
                }
                self.game.choosePlayer()
            }
            
            Toggle("Automatch", isOn: self.$game.automatch)
                .foregroundStyle(.blue)
                .tint(.blue)
                .onChange(of: self.game.automatch) {
                    if self.game.automatch {
                        Task {
                            await game.findPlayer()
                        }
                    } else {
                        GKMatchmaker.shared().cancel()
                    }
                }
        }
        .onAppear {
            if !self.game.playingGame {
                self.game.authenticatePlayer()
            }
        }
    }
}

#Preview {
    ContentView()
}
