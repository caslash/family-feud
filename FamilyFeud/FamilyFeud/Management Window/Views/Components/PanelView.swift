//
//  PanelView.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import SwiftUI

struct PanelView<Content: View>: View {
    private var title: String
    private var view: Content
    var body: some View {
        VStack {
            Text(self.title)
                .font(.title2.weight(.black))

            view
                .padding()
        }
    }
    
    init(_ title: String, @ViewBuilder view: () -> Content) {
        self.title = title
        self.view = view()
    }
}

#Preview {
    PanelView("Window Control") {
        Text("Hello, World")
    }
}
