//
//  MenuView.swift
//  FamilyFeudClient
//
//  Created by Cameron Slash on 12/16/23.
//

import FeudKit
import SwiftUI

struct MenuView: View {
    @ObservedObject private var matchmanager: MatchManager
    var body: some View {
        Form {
            Button("Start Game") {
                self.matchmanager.startMatchmaking()
            }
            
            Text(self.matchmanager.authenticationState.rawValue)
        }
        .disabled(self.matchmanager.authenticationState != .authenticated || self.matchmanager.inGame)
    }
    
    init(matchmanager: MatchManager) {
        self.matchmanager = matchmanager
    }
}

#Preview {
    MenuView(matchmanager: MatchManager())
}
