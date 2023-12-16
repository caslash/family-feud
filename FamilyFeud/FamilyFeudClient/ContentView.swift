//
//  ContentView.swift
//  FamilyFeudClient
//
//  Created by Cameron Slash on 12/10/23.
//

import FeudKit
import GameKit
import SwiftUI

struct ContentView: View {
    @StateObject private var matchmanager = MatchManager.shared
    
    var body: some View {
        MenuView(matchmanager: self.matchmanager)
        .onAppear {
            self.matchmanager.authenticateUser()
        }
        .fullScreenCover(isPresented: self.$matchmanager.inGame) {
            Text("GAME VIEW")
        }
    }
}

#Preview {
    ContentView()
}
